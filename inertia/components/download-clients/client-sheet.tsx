import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FolderBrowser } from '@/components/folder-browser'
import { SheetSection } from '@/components/settings/field-group'
import { EditorSheet, SheetField, SheetSwitch } from '@/components/settings/editor-sheet'
import { StatusBadge } from '@/components/status-badge'
import { send } from '@/components/system/system_api'
import {
  CLIENT_TYPE_ORDER,
  CLIENT_TYPES,
  clientTypeInfo,
  draftFromClient,
  validateClient,
  type ClientDraft,
  type ClientDraftErrors,
  type ClientTestResult,
  type DownloadClient,
  type DownloadClientType,
} from './clients'

export type ClientSheetMode = { kind: 'new' } | { kind: 'edit'; client: DownloadClient }

interface ClientSheetProps {
  open: boolean
  mode: ClientSheetMode
  onOpenChange: (open: boolean) => void
  /** After a save or delete; `id` is the client that changed. */
  onChanged: (id: string | null) => void
  /** A test from the editor ran against this saved client. */
  onTested?: (id: string, result: ClientTestResult) => void
}

/**
 * Add or edit a download client: how to reach it and, when it runs in its own
 * container, how its paths translate into ones Hamster can read. Test fills in
 * the paths the client reports.
 */
export function ClientSheet({ open, mode, onOpenChange, onChanged, onTested }: ClientSheetProps) {
  const client = mode.kind === 'edit' ? mode.client : null
  // The parent remounts this per opening (key), so the initial state is the reset.
  const [draft, setDraft] = useState<ClientDraft>(() => draftFromClient(client))
  const [errors, setErrors] = useState<ClientDraftErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<ClientTestResult | null>(null)
  const [browsing, setBrowsing] = useState<'complete' | 'temp' | null>(null)

  const info = clientTypeInfo(draft.type)

  const update = <K extends keyof ClientDraft>(key: K, value: ClientDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setError(null)
  }

  const changeType = (type: DownloadClientType) => {
    setDraft((current) => ({ ...current, type, port: CLIENT_TYPES[type].defaultPort }))
    setErrors({})
    setTestResult(null)
  }

  const test = async () => {
    const found = validateClient(draft)
    const blocking = { host: found.host, port: found.port, apiKey: found.apiKey }
    if (Object.values(blocking).some(Boolean)) {
      setErrors(blocking)
      return
    }
    setTesting(true)
    setTestResult(null)
    setError(null)
    try {
      const result = await send<ClientTestResult>('/api/v1/downloadclients/test', 'POST', {
        type: draft.type,
        host: draft.host.trim(),
        port: draft.port,
        apiKey: draft.apiKey,
        username: draft.username,
        password: draft.password,
        useSsl: draft.useSsl,
        urlBase: draft.urlBase,
      })
      const outcome: ClientTestResult = result ?? { success: false, error: 'No answer' }
      setTestResult(outcome)
      if (client) onTested?.(client.id, outcome)

      if (outcome.success) {
        // Fill in what the client reported. A readable folder needs no mapping.
        setDraft((current) => {
          const next = { ...current }
          if (outcome.remotePath) {
            if (outcome.pathAccessible) {
              next.remotePath = ''
              next.localPath = ''
            } else {
              next.remotePath = current.remotePath || outcome.remotePath
            }
          }
          if (outcome.remoteTempPath) {
            next.remoteTempPath = current.remoteTempPath || outcome.remoteTempPath
          }
          return next
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The client could not be tested.'
      setTestResult({ success: false, error: message })
    } finally {
      setTesting(false)
    }
  }

  const save = async () => {
    const found = validateClient(draft)
    if (Object.values(found).some(Boolean)) {
      setErrors(found)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const body = { ...draft, name: draft.name.trim(), host: draft.host.trim() }
      if (client) {
        await send(`/api/v1/downloadclients/${client.id}`, 'PUT', body)
        toast.success(`${body.name} saved`)
        onChanged(client.id)
      } else {
        const created = await send<DownloadClient>('/api/v1/downloadclients', 'POST', body)
        toast.success(`${body.name} added`)
        onChanged(created?.id ?? null)
      }
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The client was not saved.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!client) return
    try {
      await send(`/api/v1/downloadclients/${client.id}`, 'DELETE')
      toast.success(`${client.name} deleted`)
      onChanged(client.id)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The client was not deleted.')
    }
  }

  const pathField = (
    key: 'localPath' | 'localTempPath',
    which: 'complete' | 'temp',
    label: string,
    help: ReactNode,
    placeholder: string
  ) => (
    <SheetField
      label={label}
      optional
      help={browsing === which ? undefined : help}
      action={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-my-1.5 h-7"
          onClick={() => setBrowsing(browsing === which ? null : which)}
          aria-expanded={browsing === which}
        >
          {browsing === which ? 'Type a path' : 'Browse…'}
        </Button>
      }
    >
      {(props) =>
        browsing === which ? (
          <div className="rounded-md border border-border p-3">
            <FolderBrowser
              value={draft[key]}
              onChange={(path) => update(key, path)}
              hideSelectButton
            />
          </div>
        ) : (
          <Input
            {...props}
            value={draft[key]}
            onChange={(event) => update(key, event.target.value)}
            placeholder={placeholder}
            className="readout"
          />
        )
      }
    </SheetField>
  )

  return (
    <EditorSheet
      open={open}
      onOpenChange={onOpenChange}
      title={client ? client.name : 'Add download client'}
      description="How to reach it, and how its paths translate into ones Hamster can read."
      error={error}
      onSave={save}
      saveLabel={client ? 'Save' : 'Add'}
      saving={saving}
      onTest={test}
      testing={testing}
      onDelete={client ? remove : undefined}
      deleteConfirm={{
        title: `Delete ${client?.name ?? 'client'}?`,
        description:
          'Hamster stops sending grabs here and stops watching its folders. Downloads already running in the client keep going.',
      }}
    >
      <SheetSection title="Connection">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SheetField label="Name" error={errors.name}>
            {(props) => (
              <Input
                {...props}
                value={draft.name}
                onChange={(event) => update('name', event.target.value)}
                placeholder={`My ${info.label}`}
                autoComplete="off"
              />
            )}
          </SheetField>
          <SheetField label="Type">
            {(props) => (
              <Select
                value={draft.type}
                onValueChange={(value) => value && changeType(value as DownloadClientType)}
              >
                <SelectTrigger id={props.id} className="w-full">
                  <SelectValue>{(value: string) => clientTypeInfo(value).label}</SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {CLIENT_TYPE_ORDER.map((type) => (
                    <SelectItem key={type} value={type}>
                      {CLIENT_TYPES[type].label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            )}
          </SheetField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SheetField
            label="Host"
            error={errors.host}
            className="sm:col-span-2"
            help="Inside Docker, usually the container name, not localhost."
          >
            {(props) => (
              <Input
                {...props}
                value={draft.host}
                onChange={(event) => update('host', event.target.value)}
                placeholder="sabnzbd"
                autoComplete="off"
                className="readout"
              />
            )}
          </SheetField>
          <SheetField label="Port" error={errors.port}>
            {(props) => (
              <Input
                {...props}
                type="number"
                inputMode="numeric"
                min={1}
                max={65535}
                value={Number.isFinite(draft.port) ? draft.port : ''}
                onChange={(event) => update('port', Number.parseInt(event.target.value, 10))}
                className="readout"
              />
            )}
          </SheetField>
        </div>

        {info.credentials === 'apiKey' && (
          <SheetField
            label="API key"
            help={`${info.label} → Config → General.`}
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
        )}

        {info.credentials !== 'apiKey' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {info.credentials === 'userPassword' && (
              <SheetField
                label="Username"
                optional={!info.usernameRequired}
                error={errors.username}
              >
                {(props) => (
                  <Input
                    {...props}
                    value={draft.username}
                    onChange={(event) => update('username', event.target.value)}
                    autoComplete="off"
                    className="readout"
                  />
                )}
              </SheetField>
            )}
            <SheetField label="Password" optional>
              {(props) => (
                <Input
                  {...props}
                  type="password"
                  value={draft.password}
                  onChange={(event) => update('password', event.target.value)}
                  autoComplete="off"
                  className="readout"
                />
              )}
            </SheetField>
          </div>
        )}

        {info.urlBase && (
          <SheetField
            label="URL base"
            optional
            help="Usually /transmission. Change it only if you changed it in Transmission."
          >
            {(props) => (
              <Input
                {...props}
                value={draft.urlBase}
                onChange={(event) => update('urlBase', event.target.value)}
                placeholder="/transmission"
                className="readout"
              />
            )}
          </SheetField>
        )}

        <SheetField
          label="Category"
          optional
          help="Keeps Hamster's downloads in their own bucket inside the client."
        >
          {(props) => (
            <Input
              {...props}
              value={draft.category}
              onChange={(event) => update('category', event.target.value)}
              placeholder={info.protocol === 'torrent' ? 'hamster' : 'music'}
              className="readout"
            />
          )}
        </SheetField>

        <SheetSwitch
          label="Connect over HTTPS"
          checked={draft.useSsl}
          onCheckedChange={(checked) => update('useSsl', checked)}
        />

        {testResult && <TestOutcome result={testResult} />}
      </SheetSection>

      <SheetSection
        title="Path mapping"
        description="Only when the client sees its folders at other paths than Hamster does. Test fills in the remote paths."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SheetField label="Remote path (complete)" optional help="As the client sees it.">
            {(props) => (
              <Input
                {...props}
                value={draft.remotePath}
                onChange={(event) => update('remotePath', event.target.value)}
                placeholder="/downloads/complete"
                className="readout"
              />
            )}
          </SheetField>
          <SheetField label="Remote path (in progress)" optional help="As the client sees it.">
            {(props) => (
              <Input
                {...props}
                value={draft.remoteTempPath}
                onChange={(event) => update('remoteTempPath', event.target.value)}
                placeholder="/downloads/incomplete"
                className="readout"
              />
            )}
          </SheetField>
        </div>
        {pathField(
          'localPath',
          'complete',
          'Local path (complete)',
          'The same folder as Hamster sees it. Imports need it when the paths differ.',
          '/mnt/downloads/complete'
        )}
        {pathField(
          'localTempPath',
          'temp',
          'Local path (in progress)',
          'Local disk rather than a NAS mount: partial writes are the slowest part of a grab.',
          '/tmp/downloads'
        )}
      </SheetSection>

      <SheetSection title="Grabbing">
        <SheetSwitch
          label="Enabled"
          description="Off keeps it configured but sends it no grabs."
          checked={draft.enabled}
          onCheckedChange={(checked) => update('enabled', checked)}
        />
      </SheetSection>
    </EditorSheet>
  )
}

function TestOutcome({ result }: { result: ClientTestResult }) {
  if (!result.success) {
    return (
      <div role="status" className="space-y-1">
        <StatusBadge status="unreachable" />
        <p className="text-sm text-destructive">
          {result.error ||
            'The client did not answer. Check the host, port and that it is running.'}
        </p>
      </div>
    )
  }

  return (
    <div role="status" className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status="reachable">
          Connected{result.version ? ` · v${result.version}` : ''}
        </StatusBadge>
      </div>
      {result.remotePath && (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Complete folder</dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-2">
            <code className="readout min-w-0 break-all">{result.remotePath}</code>
            {result.pathAccessible ? (
              <StatusBadge tone="ok" label="Readable" />
            ) : (
              <StatusBadge tone="warning" label="Needs path mapping" />
            )}
          </dd>
          {result.remoteTempPath && (
            <>
              <dt className="text-muted-foreground">In-progress folder</dt>
              <dd className="min-w-0">
                <code className="readout break-all">{result.remoteTempPath}</code>
              </dd>
            </>
          )}
        </dl>
      )}
    </div>
  )
}
