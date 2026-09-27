/**
 * A source of the user's taste for the dashboard's For you deck.
 *
 * Providers say what the user likes (seeds, which pull in similar titles),
 * what they have already seen (never suggested), and optionally titles to
 * suggest directly (a watchlist, the provider's own recommendations). The
 * deck merges every active provider and never names one itself — adding a
 * source means implementing this and listing it in `registry.ts`.
 */

export type TasteKind = 'movie' | 'tv'

export interface TasteSeed {
  kind: TasteKind
  tmdbId: number
  title: string
  /** 0–1. A 10/10 rating or a favourite is 1; merely watched is low. */
  weight: number
  /** Shown on the card, e.g. "Because you rated Heat 9/10 on Simkl". */
  reason: string
}

export interface TastePick {
  kind: TasteKind
  tmdbId: number
  /** 0–1, how strongly to push it up the deck. */
  weight: number
  reason: string
}

export interface TasteSnapshot {
  seeds: TasteSeed[]
  seen: { kind: TasteKind; tmdbId: number }[]
  picks: TastePick[]
}

export type TasteProviderState =
  /** Contributing. */
  | 'active'
  /** Not set up; the settings page explains how. */
  | 'off'
  /** Set up, but the last read failed. */
  | 'error'

export interface TasteProviderStatus {
  id: string
  label: string
  state: TasteProviderState
  /** One line for the deck's footnote, e.g. "412 ratings" or the error. */
  detail: string | null
}

export interface TasteProvider {
  id: string
  label: string
  /** Read the provider: null when it is not set up; throws when set up but unreachable. */
  collect(): Promise<TasteSnapshot | null>
  /** Summary for display once collect() has run (or failed). */
  describe(snapshot: TasteSnapshot | null, error: unknown): string | null
}

export const EMPTY_SNAPSHOT: TasteSnapshot = { seeds: [], seen: [], picks: [] }
