import { useCallback, useEffect, useState } from 'react'
import { Section } from './section'
import { RowGroup } from './row-group'
import { SelectRow, ToggleRow } from './setting-row'
import { getJson, send } from '@/components/system/system_api'

export interface LocalAccessOptions {
  enabled: boolean
  /** null means the first administrator account. */
  userId: string | null
}

export interface LocalAccessAccount {
  id: string
  fullName: string | null
  email: string
  isAdmin: boolean
}

/** Select items cannot carry null, so the default choice gets a stand-in value. */
export const FIRST_ADMIN = 'first-admin'

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Hamster is unreachable.'
}

/**
 * Users & access → Sign-in: whether the local network gets in without a
 * login, and as whom. Both rows save as they change.
 *
 * The account list comes from the page, which already loads it, so the choice
 * stays in step when accounts are added or removed there. Until it arrives
 * (`users` null) the account row waits rather than guessing.
 */
export function LocalAccessSection({ users }: { users: LocalAccessAccount[] | null }) {
  const [options, setOptions] = useState<LocalAccessOptions | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await getJson<{ options: Partial<LocalAccessOptions> }>(
        '/api/v1/settings/local-access'
      )
      setOptions({ enabled: false, userId: null, ...data.options })
      setLoadError(null)
    } catch (error) {
      setLoadError(`Sign-in settings could not be loaded: ${errorText(error)}`)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** Throws on failure, so the row reverts and says why. */
  const save = async (next: LocalAccessOptions) => {
    const data = await send<{ options?: Partial<LocalAccessOptions> }>(
      '/api/v1/settings/local-access',
      'PUT',
      next
    )
    setOptions({ ...next, ...data?.options })
  }

  const accountOptions = [
    { value: FIRST_ADMIN, label: 'First administrator' },
    ...(users ?? []).map((user) => ({
      value: user.id,
      label: `${user.fullName || user.email}${user.isAdmin ? ' (admin)' : ''}`,
    })),
  ]
  const chosen = options?.userId ?? FIRST_ADMIN
  // A stored account that has since been deleted still needs a label.
  if (options?.userId && users && !users.some((user) => user.id === options.userId)) {
    accountOptions.push({ value: options.userId, label: 'Deleted account' })
  }

  return (
    <Section
      id="sign-in"
      title="Sign-in"
      description="Requests from your own network can skip the login; everyone else still signs in."
    >
      <RowGroup
        loading={options === null && !loadError}
        skeletonRows={2}
        error={loadError}
        onRetry={() => void load()}
      >
        {options && (
          <ToggleRow
            label="No login from the local network"
            description="Behind a reverse proxy it must pass the visitor's address in X-Forwarded-For."
            checked={options.enabled}
            onSave={(enabled) => save({ ...options, enabled })}
          />
        )}
        {options && users && users.length > 1 && (
          <SelectRow
            label="Local visitors use"
            description={
              options.enabled
                ? 'Pick an account without admin rights to keep settings out of reach.'
                : 'Applies once the local network skips the login.'
            }
            value={chosen}
            options={accountOptions}
            disabled={!options.enabled}
            onSave={(value) => save({ ...options, userId: value === FIRST_ADMIN ? null : value })}
          />
        )}
      </RowGroup>
    </Section>
  )
}
