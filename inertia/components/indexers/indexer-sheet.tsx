import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { SheetSection } from '@/components/settings/field-group'
import { EditorSheet, SheetField, SheetSwitch } from '@/components/settings/editor-sheet'
import { send } from '@/components/system/system_api'
import { validateIndexer, type ConnectionTest, type Indexer } from './indexers_api'

interface Draft {
  name: string
  url: string
  apiKey: string
  enabled: boolean
}

const EMPTY: Draft = { name: '', url: '', apiKey: '', enabled: true }

function draftFor(indexer: Indexer | null): Draft {
  if (!indexer) return EMPTY
  return {
    name: indexer.name,
    url: indexer.url,
    apiKey: indexer.apiKey,
    enabled: indexer.enabled,
  }
}

export type IndexerSheetMode = { kind: 'new' } | { kind: 'edit'; indexer: Indexer }

interface IndexerSheetProps {
  open: boolean
  mode: IndexerSheetMode
  onOpenChange: (open: boolean) => void
  /** After a save or delete, so the page can refetch. */
  onChanged: () => void
}

/**
 * Add or edit one Newznab indexer. Test checks the URL and key as typed,
 * before anything is saved.
 */
export function IndexerSheet({ open, mode, onOpenChange, onChanged }: IndexerSheetProps) {
  const indexer = mode.kind === 'edit' ? mode.indexer : null
  const [draft, setDraft] = useState<Draft>(() => draftFor(indexer))
  const [errors, setErrors] = useState<ReturnType<typeof validateIndexer>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (!open) return
    setDraft(draftFor(indexer))
    setErrors({})
    setError(null)
    // Reset only when the sheet (re)opens on an entity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, indexer?.id])

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setError(null)
  }

  const test = async () => {
    const found = validateIndexer(draft)
    if (found.url || found.apiKey) {
      setErrors({ url: found.url, apiKey: found.apiKey })
      return
    }
    setTesting(true)
    setError(null)
    try {
      const result = await send<ConnectionTest>('/api/v1/indexers/test', 'POST', {
        url: draft.url.trim(),
        apiKey: draft.apiKey.trim(),
      })
      if (result?.success) {
        toast.success(`${draft.name.trim() || 'The indexer'} answered: the URL and API key work.`)
      } else {
        setError(
          result?.error ||
            'The indexer rejected the request. Check the API key is current and not rate-limited.'
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The indexer could not be tested.')
    } finally {
      setTesting(false)
    }
  }

  const save = async () => {
    const found = validateIndexer(draft)
    if (Object.values(found).some(Boolean)) {
      setErrors(found)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const body = {
        name: draft.name.trim(),
        url: draft.url.trim(),
        apiKey: draft.apiKey.trim(),
        enabled: draft.enabled,
        // Kept as stored: the editor has no field for them.
        ...(indexer ? { categories: indexer.categories, priority: indexer.priority } : {}),
      }
      if (indexer) {
        await send(`/api/v1/indexers/${indexer.id}`, 'PUT', body)
        toast.success(`${body.name} saved`)
      } else {
        await send('/api/v1/indexers', 'POST', body)
        toast.success(`${body.name} added`)
      }
      onChanged()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The indexer was not saved.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!indexer) return
    try {
      await send(`/api/v1/indexers/${indexer.id}`, 'DELETE')
      toast.success(`${indexer.name} deleted`)
      onChanged()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The indexer was not deleted.')
    }
  }

  return (
    <EditorSheet
      open={open}
      onOpenChange={onOpenChange}
      title={indexer ? indexer.name : 'Add indexer'}
      description="A Newznab-compatible indexer that Hamster queries itself."
      error={error}
      onSave={save}
      saveLabel={indexer ? 'Save' : 'Add'}
      saving={saving}
      onTest={test}
      testing={testing}
      onDelete={indexer ? remove : undefined}
      deleteConfirm={{
        title: `Delete ${indexer?.name ?? 'indexer'}?`,
        description:
          'The indexer and its API key are removed and searches skip it. Releases already grabbed are unaffected.',
      }}
    >
      <SheetSection title="Connection">
        <SheetField label="Name" error={errors.name}>
          {(props) => (
            <Input
              {...props}
              value={draft.name}
              onChange={(event) => update('name', event.target.value)}
              placeholder="NZBgeek"
              autoComplete="off"
            />
          )}
        </SheetField>
        <SheetField
          label="URL"
          help="The site root, without /api: Hamster adds it."
          error={errors.url}
        >
          {(props) => (
            <Input
              {...props}
              value={draft.url}
              onChange={(event) => update('url', event.target.value)}
              placeholder="https://indexer.example.com"
              inputMode="url"
              autoComplete="off"
              className="readout"
            />
          )}
        </SheetField>
        <SheetField label="API key" error={errors.apiKey}>
          {(props) => (
            <Input
              {...props}
              type="password"
              value={draft.apiKey}
              onChange={(event) => update('apiKey', event.target.value)}
              autoComplete="off"
              className="readout"
            />
          )}
        </SheetField>
      </SheetSection>
      <SheetSection title="Searching">
        <SheetSwitch
          label="Enabled"
          description="Off keeps it configured but out of every search."
          checked={draft.enabled}
          onCheckedChange={(checked) => update('enabled', checked)}
        />
      </SheetSection>
    </EditorSheet>
  )
}
