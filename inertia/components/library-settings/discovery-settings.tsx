import { useCallback, useEffect, useRef, useState } from 'react'
import { SettingsPage } from '@/components/settings/settings-page'
import { Section } from '@/components/settings/section'
import { RowGroup } from '@/components/settings/row-group'
import { CredentialRow, SelectRow, SettingRow, ToggleRow } from '@/components/settings/setting-row'
import { TmdbKeyDialog, TmdbKeyRow } from '@/components/settings/tmdb-key-dialog'
import { AccountConnect } from '@/components/settings/account-connect'
import { getJson } from '@/components/system/system_api'
import { useLibrarySettings } from '@/hooks/use_library_settings'
import {
  REGION_OPTIONS,
  type AppSettings,
  type RecommendationSettings,
  type StreamingProvider,
} from './library_catalog'
import { StreamingServicesSection } from './streaming-services-section'

const LANE_OPTIONS = [
  { value: '1', label: '1 lane' },
  { value: '2', label: '2 lanes' },
  { value: '3', label: '3 lanes' },
  { value: '5', label: '5 lanes' },
]

const SIMKL_HELP = (
  <>
    Register a free app at{' '}
    <a
      href="https://simkl.com/settings/developer/"
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline-offset-4 hover:underline"
    >
      simkl.com/settings/developer
    </a>{' '}
    as <em>TV, devices &amp; command line</em>; no redirect URL or secret is needed. Changing the ID
    disconnects the current Simkl account.
  </>
)

/**
 * Writes that replace a whole value (the recommendation block, the provider
 * list) are composed from the newest value — including one still in flight —
 * so two quick changes never undo each other.
 */
function usePendingValue<T>(stored: () => T | undefined) {
  const pending = useRef<T | null>(null)
  const inFlight = useRef(0)
  return useCallback(
    async (compose: (base: T) => T, write: (next: T) => Promise<unknown>) => {
      const base = pending.current ?? stored()
      if (base === undefined) throw new Error('Settings have not loaded yet.')
      const next = compose(base)
      pending.current = next
      inFlight.current++
      try {
        await write(next)
      } catch (error) {
        pending.current = null
        throw error
      } finally {
        inFlight.current--
        if (inFlight.current === 0) pending.current = null
      }
    },
    [stored]
  )
}

function accountDescription(account: AppSettings['accounts'][number]): string {
  if (account.account) {
    return `Your ${account.label} ratings and history shape the For you deck, and your watchlist is suggested there.`
  }
  if (account.configured) {
    return `Connect it so your ${account.label} ratings, history and watchlist shape the For you deck.`
  }
  return `Add the ${account.label} client ID under Credentials first.`
}

/**
 * Settings → Discovery: metadata credentials, the JustWatch region, what fills
 * the Search lanes, connected accounts and your streaming services. Every
 * control saves as it changes and sends only its own fields.
 */
export function DiscoverySettings() {
  const library = useLibrarySettings({ settings: true })
  const settings = library.settings.data
  const [tmdbOpen, setTmdbOpen] = useState(false)
  const [providers, setProviders] = useState<StreamingProvider[] | null>(null)
  const [providersError, setProvidersError] = useState<string | null>(null)
  const [providersLoading, setProvidersLoading] = useState(false)

  const hasTmdbKey = Boolean(settings?.hasTmdbApiKey)
  const locale = settings?.justwatchLocale ?? 'en_US'

  const loadProviders = useCallback(async () => {
    setProvidersLoading(true)
    setProvidersError(null)
    try {
      const data = await getJson<{ providers?: StreamingProvider[] }>(
        '/api/v1/settings/watch-providers'
      )
      setProviders(data.providers ?? [])
    } catch (err) {
      setProvidersError(
        `Streaming services could not be loaded: ${err instanceof Error ? err.message : 'Hamster did not answer.'}`
      )
    } finally {
      setProvidersLoading(false)
    }
  }, [])

  // The list depends on the key and on the region.
  useEffect(() => {
    if (hasTmdbKey) void loadProviders()
  }, [hasTmdbKey, locale, loadProviders])

  const { latestSettings } = library
  const recommendations = useCallback(
    () => latestSettings()?.recommendationSettings,
    [latestSettings]
  )
  const selection = useCallback(
    () => latestSettings()?.selectedStreamingProviders,
    [latestSettings]
  )
  const writeRecommendations = usePendingValue<RecommendationSettings>(recommendations)
  const writeSelection = usePendingValue<number[]>(selection)

  const saveRecommendations = (patch: Partial<RecommendationSettings>, justwatch?: boolean) =>
    writeRecommendations(
      (base) => ({ ...base, ...patch }),
      (next) =>
        library.saveSettings(
          justwatch === undefined
            ? { recommendationSettings: next }
            : { recommendationSettings: next, justwatchEnabled: justwatch }
        )
    )

  const needsTmdbKey = Boolean(
    settings?.enabledMediaTypes.some((type) => type === 'movies' || type === 'tv')
  )
  const rec = settings?.recommendationSettings
  const loading = library.settings.loading
  const loadError = library.settings.error
  const retry = () => void library.reload('settings')

  return (
    <SettingsPage
      title="Discovery"
      description="Metadata keys, what fills the Search lanes, connected accounts and your services."
      ready={!loading}
    >
      <Section
        id="credentials"
        title="Credentials"
        description="Keys for the services behind metadata and accounts. Stored values are never shown."
      >
        <RowGroup loading={loading} skeletonRows={2} error={loadError} onRetry={retry}>
          {settings && (
            <TmdbKeyRow
              isSet={hasTmdbKey}
              required={needsTmdbKey}
              onSave={(key) => library.saveSettings({ tmdbApiKey: key })}
            />
          )}
          {settings && (
            <CredentialRow
              label="Simkl client ID"
              description={
                settings.simklClientId ? (
                  <>
                    <span className="readout text-xs">{settings.simklClientId}</span> · lets you
                    connect a Simkl account
                  </>
                ) : (
                  'Needed to connect a Simkl account.'
                )
              }
              isSet={Boolean(settings.simklClientId)}
              required={false}
              help={SIMKL_HELP}
              placeholder="Client ID"
              onSave={(value) => library.saveSettings({ simklClientId: value })}
              onRemove={() => library.saveSettings({ simklClientId: '' })}
            />
          )}
        </RowGroup>
      </Section>

      <Section id="region" title="Region">
        <RowGroup loading={loading} skeletonRows={1} error={loadError} onRetry={retry}>
          {settings && (
            <SelectRow
              label="JustWatch region"
              description="Where streaming availability and the list of services are looked up."
              value={settings.justwatchLocale}
              options={REGION_OPTIONS}
              onSave={(justwatchLocale) => library.saveSettings({ justwatchLocale })}
            />
          )}
        </RowGroup>
      </Section>

      <Section
        id="sources"
        title="Sources"
        description="What fills the lanes on the Search page. Each runs on its own."
      >
        <RowGroup loading={loading} skeletonRows={4} error={loadError} onRetry={retry}>
          {settings && rec && (
            <ToggleRow
              label="JustWatch"
              description="Streaming badges on titles, and a lane of what's popular on your services."
              checked={settings.justwatchEnabled}
              onSave={(justwatchEnabled) =>
                saveRecommendations({ justwatchEnabled }, justwatchEnabled)
              }
            />
          )}
          {rec && (
            <ToggleRow
              label="Simkl trending"
              description="What's most watched on Simkl this week and this month. Needs no account."
              checked={rec.simklEnabled}
              onSave={(simklEnabled) => saveRecommendations({ simklEnabled })}
            />
          )}
          {rec && (
            <ToggleRow
              label="Personalised lanes"
              description="“Because you have…” lanes built from your library with TMDB recommendations."
              checked={rec.personalizedEnabled}
              onSave={(personalizedEnabled) => saveRecommendations({ personalizedEnabled })}
            />
          )}
          {rec && (
            <SelectRow
              label="Personalised lanes shown"
              description={
                rec.personalizedEnabled
                  ? 'At most this many, from the titles added most recently.'
                  : 'Used once personalised lanes are on.'
              }
              value={String(rec.maxPersonalizedLanes)}
              options={LANE_OPTIONS}
              disabled={!rec.personalizedEnabled}
              triggerClassName="md:w-32"
              onSave={(value) =>
                saveRecommendations({ maxPersonalizedLanes: Number.parseInt(value, 10) })
              }
            />
          )}
        </RowGroup>
      </Section>

      <Section
        id="accounts"
        title="Accounts"
        description="Connected accounts shape the For you deck, for everyone on this install."
      >
        <RowGroup
          loading={loading}
          skeletonRows={1}
          error={loadError}
          onRetry={retry}
          empty="No account can be connected on this install."
        >
          {(settings?.accounts ?? []).map((account) => (
            <SettingRow
              key={account.id}
              label={`${account.label} account`}
              description={accountDescription(account)}
              stack
              control={
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 md:justify-end [&>span]:min-w-0">
                  <AccountConnect
                    provider={account.id}
                    label={account.label}
                    account={account.account}
                    canConnect={account.configured}
                    onChange={(connected) =>
                      library.update('settings', (data: AppSettings) => ({
                        ...data,
                        accounts: data.accounts.map((a) =>
                          a.id === account.id ? { ...a, account: connected } : a
                        ),
                      }))
                    }
                  />
                </div>
              }
            />
          ))}
        </RowGroup>
      </Section>

      <StreamingServicesSection
        hasTmdbKey={settings ? hasTmdbKey : loadError ? true : null}
        onAddTmdbKey={() => setTmdbOpen(true)}
        providers={providers}
        loading={(hasTmdbKey && providers === null && !providersError) || providersLoading}
        error={loadError ?? providersError}
        onRetry={() => (loadError ? retry() : void loadProviders())}
        locale={locale}
        selected={settings?.selectedStreamingProviders ?? []}
        onChange={(next) =>
          writeSelection(
            () => next,
            (value) => library.saveSettings({ selectedStreamingProviders: value })
          )
        }
      />

      <TmdbKeyDialog
        open={tmdbOpen}
        onOpenChange={setTmdbOpen}
        isSet={hasTmdbKey}
        onSave={(key) => library.saveSettings({ tmdbApiKey: key })}
      />
    </SettingsPage>
  )
}
