import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import UserSetting from '#models/user_setting'
import RecommendationFeedback from '#models/recommendation_feedback'
import type { FeedbackMediaType } from '#models/recommendation_feedback'
import {
  forYouService,
  interleave,
  enabledDeckTypes,
  DECK_MODES,
} from '#services/recommendations/for_you_service'
import type {
  DeckMode,
  ForYouCard,
  ForYouDeck,
  TasteProfile,
} from '#services/recommendations/for_you_service'

/**
 * The For you deck, built ahead of time and kept in `for_you_pools`: one pool
 * per user, deck mode and media type. Building takes dozens of TMDB lookups,
 * so the dashboard only ever reads a pool; building happens
 *
 * - every night (and after startup) for every deck mode and each user's
 *   chosen types, through the `for_you_refresh` task;
 * - in the background whenever a pool the user is swiping through runs low
 *   (fewer than `REFILL_AT` cards left), is stale (their taste moved on since),
 *   or is older than a day — per type, so a type nobody looks at is never
 *   rebuilt outside the nightly run;
 * - right away only when there is no pool at all yet, or the user asks for a
 *   fresh deck.
 */

/** Fewer cards than this left of one type and that type is topped up. */
export const REFILL_AT = 5
/** A pool older than this is rebuilt on the next read. */
const MAX_AGE_MS = 26 * 60 * 60 * 1000
/** A top-up that found (next to) nothing new is not retried sooner than this. */
const TOP_UP_COOLDOWN_MS = 10 * 60 * 1000
/** Seconds-apart builds of several types share one taste profile. */
const TASTE_TTL_MS = 10 * 60 * 1000

/** How much of the deck each type gets, before the user filters. */
const TYPE_WEIGHT: Record<FeedbackMediaType, number> = { movie: 3, tv: 2, album: 2, book: 1 }

interface PoolRow {
  media_type: FeedbackMediaType
  cards: ForYouCard[]
  signals: ForYouDeck['signals'] | null
  stale: boolean
  built_at: Date
}

export interface PooledDeck extends ForYouDeck {
  /** Types being built or topped up right now; worth asking again shortly. */
  refilling: FeedbackMediaType[]
}

const poolKey = (userId: string, mode: DeckMode, type: FeedbackMediaType) =>
  `${userId}:${mode}:${type}`

class ForYouPools {
  private building = new Map<string, Promise<void>>()
  private lastTopUp = new Map<string, number>()
  private tastes = new Map<string, { at: number; profile: Promise<TasteProfile> }>()

  async getDeck(
    userId: string,
    { refresh = false, mode = 'for-you' as DeckMode } = {}
  ): Promise<PooledDeck> {
    const types = await enabledDeckTypes()
    if (refresh) {
      this.forgetTaste(userId)
      await Promise.all(types.map((t) => this.rebuild(userId, mode, t)))
    }

    let rows = await this.load(userId, mode)
    const missing = types.filter((t) => !rows.has(t))
    if (missing.length > 0) {
      await Promise.all(missing.map((t) => this.rebuild(userId, mode, t)))
      rows = await this.load(userId, mode)
    }

    const acted = await this.actedKeys(userId)
    const now = Date.now()
    const sources: { cards: ForYouCard[]; weight: number }[] = []
    let signals: ForYouDeck['signals'] | null = null
    let newest = 0
    for (const type of types) {
      const row = rows.get(type)
      if (!row) continue
      const left = row.cards.filter((c) => !acted.has(c.key))
      sources.push({ cards: left, weight: TYPE_WEIGHT[type] })
      const builtAt = new Date(row.built_at).getTime()
      if (row.signals && builtAt > newest) {
        signals = row.signals
        newest = builtAt
      }

      if (row.stale || now - builtAt > MAX_AGE_MS) this.schedule(userId, mode, type, false)
      else if (left.length < REFILL_AT) this.schedule(userId, mode, type, true)
    }

    return {
      cards: interleave(sources),
      signals: signals ?? { sources: [], requests: 0, library: 0 },
      refilling: types.filter((t) => this.building.has(poolKey(userId, mode, t))),
    }
  }

  /**
   * After a swipe: a request or a save changes the user's taste, so every
   * pool of that type is marked for a rebuild; and if the pool being swiped
   * through is running low, it is topped up now rather than on the next load.
   */
  async afterFeedback(userId: string, mediaType: FeedbackMediaType, action: string) {
    if (action !== 'skipped') {
      this.forgetTaste(userId)
      await db
        .from('for_you_pools')
        .where('user_id', userId)
        .where('media_type', mediaType)
        .update({ stale: true })
    }
    const mode = await this.savedMode(userId)
    const rows = await this.load(userId, mode)
    const row = rows.get(mediaType)
    if (!row) return
    const acted = await this.actedKeys(userId)
    const left = row.cards.filter((c) => !acted.has(c.key)).length
    if (left < REFILL_AT) this.schedule(userId, mode, mediaType, true)
  }

  /** The user's taste changed wholesale (a skip list cleared, a save undone). */
  async invalidate(userId: string) {
    this.forgetTaste(userId)
    await db.from('for_you_pools').where('user_id', userId).update({ stale: true })
  }

  /** A settings change that affects every user's taste (an account linked). */
  async invalidateAll() {
    this.tastes.clear()
    await db.from('for_you_pools').update({ stale: true })
  }

  /**
   * The nightly run: every deck mode of every user, for the types they chose
   * (all enabled types when they chose none), rebuilt from a fresh taste
   * profile — so switching to New or Classics is as instant as the default.
   * Each user's saved mode goes first for everyone, then the other modes, so
   * the deck people actually open is ready soonest after a restart.
   */
  async refreshAll(): Promise<{ built: number; errors: string[] }> {
    const types = await enabledDeckTypes()
    const users = await User.query().select('id')
    const settings = await UserSetting.query().select('userId', 'forYouTypes', 'forYouMode')
    const byUser = new Map(settings.map((s) => [s.userId, s]))
    const errors: string[] = []
    let built = 0

    const plans = users.map((user) => {
      const setting = byUser.get(user.id)
      const saved = DECK_MODES.includes(setting?.forYouMode as DeckMode)
        ? (setting!.forYouMode as DeckMode)
        : 'for-you'
      const chosen = setting?.forYouTypes?.length
        ? types.filter((t) => setting.forYouTypes!.includes(t))
        : types
      this.forgetTaste(user.id)
      return {
        userId: user.id,
        modes: [saved, ...DECK_MODES.filter((m) => m !== saved)],
        types: chosen.length > 0 ? chosen : types,
      }
    })

    for (let round = 0; round < DECK_MODES.length; round++) {
      for (const plan of plans) {
        const mode = plan.modes[round]
        // One pool at a time: TMDB allows four requests a second.
        for (const type of plan.types) {
          try {
            await this.rebuild(plan.userId, mode, type)
            built++
          } catch (error) {
            errors.push(
              `${type} (${mode}) for ${plan.userId}: ${(error as Error).message ?? error}`
            )
          }
        }
      }
    }
    return { built, errors }
  }

  // ---------------------------------------------------------------------------

  /** Build in the background, once at a time per pool. */
  private schedule(userId: string, mode: DeckMode, type: FeedbackMediaType, topUp: boolean) {
    const key = poolKey(userId, mode, type)
    if (this.building.has(key)) return
    if (topUp && Date.now() - (this.lastTopUp.get(key) ?? 0) < TOP_UP_COOLDOWN_MS) return
    this.rebuild(userId, mode, type, { topUp }).catch((error) =>
      console.error(`[ForYou] Building ${type} (${mode}) failed:`, error)
    )
  }

  /**
   * Build one pool. A top-up keeps the cards not yet acted on and adds new
   * ones behind them; otherwise the pool is replaced.
   */
  private rebuild(
    userId: string,
    mode: DeckMode,
    type: FeedbackMediaType,
    { topUp = false } = {}
  ): Promise<void> {
    const key = poolKey(userId, mode, type)
    const inFlight = this.building.get(key)
    if (inFlight) return inFlight

    const run = (async () => {
      const kept: ForYouCard[] = []
      if (topUp) {
        const rows = await this.load(userId, mode)
        const row = rows.get(type)
        const acted = await this.actedKeys(userId)
        kept.push(...(row?.cards ?? []).filter((c) => !acted.has(c.key)))
      }
      const taste = await this.taste(userId)
      const fresh = await forYouService.buildType(
        userId,
        mode,
        type,
        taste,
        new Set(kept.map((c) => c.key))
      )
      const signals: ForYouDeck['signals'] = { sources: taste.sources, ...taste.counts }
      await db.rawQuery(
        `INSERT INTO for_you_pools (user_id, mode, media_type, cards, signals, stale, built_at)
         VALUES (?, ?, ?, ?::jsonb, ?::jsonb, false, now())
         ON CONFLICT (user_id, mode, media_type)
         DO UPDATE SET cards = EXCLUDED.cards, signals = EXCLUDED.signals,
                       stale = false, built_at = now()`,
        [userId, mode, type, JSON.stringify([...kept, ...fresh]), JSON.stringify(signals)]
      )
      // A top-up that found next to nothing has run out of titles for now;
      // rest before trying again rather than rebuilding on every read.
      if (topUp && fresh.length < REFILL_AT) this.lastTopUp.set(key, Date.now())
    })().finally(() => this.building.delete(key))

    this.building.set(key, run)
    return run
  }

  private taste(userId: string): Promise<TasteProfile> {
    const cached = this.tastes.get(userId)
    if (cached && Date.now() - cached.at < TASTE_TTL_MS) return cached.profile
    const profile = forYouService.buildTasteProfile(userId)
    this.tastes.set(userId, { at: Date.now(), profile })
    profile.catch(() => this.tastes.delete(userId))
    return profile
  }

  private forgetTaste(userId: string) {
    this.tastes.delete(userId)
  }

  private async load(userId: string, mode: DeckMode): Promise<Map<FeedbackMediaType, PoolRow>> {
    const rows = (await db
      .from('for_you_pools')
      .where('user_id', userId)
      .where('mode', mode)
      .select('media_type', 'cards', 'signals', 'stale', 'built_at')) as PoolRow[]
    return new Map(rows.map((r) => [r.media_type, r]))
  }

  private async actedKeys(userId: string): Promise<Set<string>> {
    const acted = await RecommendationFeedback.query()
      .where('userId', userId)
      .select('mediaType', 'externalId')
    return new Set(acted.map((f) => `${f.mediaType}:${f.externalId}`))
  }

  private async savedMode(userId: string): Promise<DeckMode> {
    const setting = await UserSetting.findBy('userId', userId)
    return DECK_MODES.includes(setting?.forYouMode as DeckMode)
      ? (setting!.forYouMode as DeckMode)
      : 'for-you'
  }
}

export const forYouPools = new ForYouPools()
