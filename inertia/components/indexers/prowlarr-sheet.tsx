import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { SheetSection } from '@/components/settings/field-group'
import { EditorSheet, SheetField, SheetSwitch } from '@/components/settings/editor-sheet'
import { send } from '@/components/system/system_api'
import { isHttpUrl, type ConnectionTest, type ProwlarrConfig } from './indexers_api'

interface Draft {
  url: string
  apiKey: string
  enabled: boolean
}

type Errors = Partial<Record<'url' | 'apiKey', string>>

function validate(draft: Draft): Errors {
  const errors: Errors = {}
  if (!draft.url.trim()) errors.url = 'The Prowlarr URL is required.'
  else if (!isHttpUrl(draft.url.trim())) errors.url = 'Start with http:// or https://.'
  if (!draft.apiKey.trim()) errors.apiKey = 'The API key is required.'
  return errors
}

interface ProwlarrSheetProps {
  open: boolean
  config: ProwlarrConfig | null
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}

/** Connect Prowlarr, or change how Hamster reaches it. */
export function ProwlarrSheet({ open, config, onOpenChange, onChanged }: ProwlarrSheetProps) {
  const connected = Boolean(config?.configured)
  const [draft, setDraft] = useState<Draft>({ url: '', apiKey: '', enabled: true })
  const [errors, setErrors] = useState<Errors>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (!open) return
    setDraft({
      url: config?.configured ? config.url : '',
      apiKey: config?.configured ? config.apiKey : '',
      enabled: config?.configured ? config.enabled : true,
    })
    setErrors({})
    setError(null)
    // Reset only when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setError(null)
  }

  const test = async () => {
    const found = validate(draft)
    if (found.url || found.apiKey) {
      setErrors(found)
      return
    }
    setTesting(true)
    setError(null)
    try {
      const result = await send<ConnectionTest>('/api/v1/prowlarr/test', 'POST', {
        url: draft.url.trim(),
        apiKey: draft.apiKey.trim(),
      })
      if (result?.success) {
        toast.success(
          result.version ? `Prowlarr ${result.version} answered.` : 'Prowlarr answered.'
        )
      } else {
        setError(
          result?.error
            ? `Prowlarr: ${result.error}`
            : 'Prowlarr rejected the request. Check the API key under Settings → General.'
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prowlarr could not be tested.')
    } finally {
      setTesting(false)
    }
  }

  const save = async () => {
    const found = validate(draft)
    if (found.url || found.apiKey) {
      setErrors(found)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await send('/api/v1/prowlarr', 'PUT', {
        url: draft.url.trim(),
        apiKey: draft.apiKey.trim(),
        enabled: draft.enabled,
      })
      toast.success(connected ? 'Prowlarr saved' : 'Prowlarr connected')
      onChanged()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prowlarr was not saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <EditorSheet
      open={open}
      onOpenChange={onOpenChange}
      title={connected ? 'Prowlarr' : 'Connect Prowlarr'}
      description="One connection that searches every indexer Prowlarr manages."
      error={error}
      onSave={save}
      saveLabel={connected ? 'Save' : 'Connect'}
      saving={saving}
      onTest={test}
      testing={testing}
    >
      <SheetSection title="Connection">
        <SheetField
          label="URL"
          help="Reachable from Hamster. Inside Docker, usually the container name, not localhost."
          error={errors.url}
        >
          {(props) => (
            <Input
              {...props}
              value={draft.url}
              onChange={(event) => update('url', event.target.value)}
              placeholder="http://prowlarr:9696"
              inputMode="url"
              autoComplete="off"
              className="readout"
            />
          )}
        </SheetField>
        <SheetField
          label="API key"
          help="Prowlarr → Settings → General → API Key."
          error={errors.apiKey}
        >
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
          label="Search through Prowlarr"
          description="Off keeps the connection but leaves Prowlarr out of every search."
          checked={draft.enabled}
          onCheckedChange={(checked) => update('enabled', checked)}
        />
      </SheetSection>
    </EditorSheet>
  )
}
