import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  ArrowDown01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Delete01Icon,
  FlashIcon,
} from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/ui/spinner'
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useConfirmDialog } from '@/hooks/use_confirm_dialog'
import { cn } from '@/lib/utils'
import { SheetSection } from '@/components/settings/field-group'
import { EDITOR_SHEET_CLASS, SheetField } from '@/components/settings/editor-sheet'
import { ALL_MEDIA, DEFAULT_EVENTS, type EventFlags, type MediaFlags } from './event_catalog'
import { EventPicker, MediaPicker } from './event-picker'
import { DeliveryLog } from './delivery-log'
import type { AddChoice } from './add-target-picker'
import {
  WEBHOOK_PRESETS,
  clearTargetDeliveries,
  detectPreset,
  fetchTargetDeliveries,
  providerLabel,
  providerToTarget,
  requestJson,
  targetPath,
  webhookToTarget,
  type Delivery,
  type ProviderField,
  type ProviderRecord,
  type ProviderType,
  type Target,
  type TestResult,
  type WebhookMethod,
  type WebhookPresetId,
  type WebhookRecord,
} from './targets'

const MASK = '****'
const METHODS: WebhookMethod[] = ['GET', 'POST', 'PUT', 'PATCH']

/** What Hamster sends when no template is set. Mirrors WebhookPayload on the server. */
const EXAMPLE_PAYLOAD = JSON.stringify(
  {
    eventType: 'import.completed',
    instanceName: 'Hamster',
    media: { id: '123', title: 'Movie Title', year: 2024, mediaType: 'movies' },
    files: [{ path: '/media/movies/Movie Title (2024)/Movie Title (2024).mkv', quality: '1080p' }],
  },
  null,
  2
)

export type TargetSheetMode = { kind: 'new'; choice: AddChoice } | { kind: 'edit'; target: Target }

interface HeaderRow {
  id: number
  name: string
  value: string
}

interface Draft {
  name: string
  enabled: boolean
  events: EventFlags
  media: MediaFlags
  /** Push: current field values. A stored secret starts empty ("type to replace"). */
  settings: Record<string, string | boolean>
  /** Webhook, new from a preset: the preset's own fields. */
  presetValues: Record<string, string>
  /** Webhook: the URL (masked parts stay masked). */
  url: string
  method: WebhookMethod
  headers: HeaderRow[]
  payloadTemplate: string
}

/** Which target a sheet session is about, once it exists. */
type Identity =
  | { kind: 'provider'; type: string; record: ProviderRecord | null }
  | { kind: 'webhook'; preset: WebhookPresetId | null; record: WebhookRecord | null }

let headerRowId = 0
function headerRows(headers: Record<string, string> | null | undefined): HeaderRow[] {
  return Object.entries(headers ?? {}).map(([name, value]) => ({ id: ++headerRowId, name, value }))
}

function isMasked(value: unknown): value is string {
  return typeof value === 'string' && value.includes(MASK)
}

function draftFromProvider(record: ProviderRecord, fields: readonly ProviderField[]): Draft {
  const target = providerToTarget(record)
  const settings: Record<string, string | boolean> = {}
  for (const field of fields) {
    const stored = record.settings[field.name]
    if (field.type === 'boolean') settings[field.name] = stored === true || stored === 'true'
    else if (isMasked(stored)) settings[field.name] = ''
    else settings[field.name] = stored === undefined || stored === null ? '' : String(stored)
  }
  return {
    name: record.name,
    enabled: record.enabled,
    events: target.events,
    media: target.media ?? { ...ALL_MEDIA },
    settings,
    presetValues: {},
    url: '',
    method: 'POST',
    headers: [],
    payloadTemplate: '',
  }
}

function draftFromWebhook(record: WebhookRecord): Draft {
  return {
    name: record.name,
    enabled: record.enabled,
    events: webhookToTarget(record).events,
    media: { ...ALL_MEDIA },
    settings: {},
    presetValues: {},
    url: record.url,
    method: record.method,
    headers: headerRows(record.headers),
    payloadTemplate: record.payloadTemplate ?? '',
  }
}

function newDraft(choice: AddChoice, fields: readonly ProviderField[]): Draft {
  const base: Draft = {
    name: '',
    enabled: true,
    events: { ...DEFAULT_EVENTS },
    media: { ...ALL_MEDIA },
    settings: {},
    presetValues: {},
    url: '',
    method: 'POST',
    headers: [],
    payloadTemplate: '',
  }
  if (choice.kind === 'provider') {
    for (const field of fields) base.settings[field.name] = field.type === 'boolean' ? false : ''
    return base
  }
  const preset = WEBHOOK_PRESETS[choice.preset]
  return {
    ...base,
    name: preset.defaultName,
    events: { ...preset.events },
    method: preset.method,
    payloadTemplate: preset.payloadTemplate ?? '',
  }
}

function identityOf(mode: TargetSheetMode): Identity {
  if (mode.kind === 'new') {
    return mode.choice.kind === 'provider'
      ? { kind: 'provider', type: mode.choice.type, record: null }
      : { kind: 'webhook', preset: mode.choice.preset, record: null }
  }
  const { target } = mode
  return target.kind === 'provider'
    ? { kind: 'provider', type: target.provider!.type, record: target.provider! }
    : { kind: 'webhook', preset: null, record: target.webhook! }
}

function validUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

interface TargetSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: TargetSheetMode
  providerTypes: readonly ProviderType[]
  /** A create, update, test or clear happened: refresh the list and the log. */
  onChanged: () => void
}

/**
 * The editor for one target, push or HTTP. Settings and Deliveries tabs once it
 * exists; Delete on the left of the footer, Test and Save on the right. Test
 * saves first when there is anything unsaved, since it uses what is stored.
 */
export function TargetSheet({
  open,
  onOpenChange,
  mode,
  providerTypes,
  onChanged,
}: TargetSheetProps) {
  const [identity, setIdentity] = useState<Identity>(() => identityOf(mode))
  const providerType =
    identity.kind === 'provider' ? providerTypes.find((t) => t.type === identity.type) : undefined
  // Keyed on the field names, so a refetch of the types list never wipes a draft.
  const fieldsKey = (providerType?.fields ?? []).map((field) => field.name).join(',')
  const fieldsRef = useRef<readonly ProviderField[]>([])
  fieldsRef.current = providerType?.fields ?? []
  const fields = useMemo(() => fieldsRef.current, [fieldsKey])

  const initial = useMemo(() => {
    if (identity.kind === 'provider') {
      return identity.record
        ? draftFromProvider(identity.record, fields)
        : newDraft({ kind: 'provider', type: identity.type }, fields)
    }
    return identity.record
      ? draftFromWebhook(identity.record)
      : newDraft({ kind: 'webhook', preset: identity.preset ?? 'custom' }, fields)
  }, [identity, fields])

  const [draft, setDraft] = useState<Draft>(initial)
  const [baseline, setBaseline] = useState<Draft>(initial)
  // Push types arrive after the sheet can open; seed the empty field values once they do.
  useEffect(() => {
    setDraft(initial)
    setBaseline(initial)
  }, [initial])

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [tab, setTab] = useState<'settings' | 'deliveries'>('settings')
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null)
  const [deliveriesError, setDeliveriesError] = useState<string | null>(null)
  const confirmDialog = useConfirmDialog()
  const enabledId = useId()

  const exists = identity.record !== null
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline)
  const busy = saving || testing

  const currentTarget: Target | null = useMemo(() => {
    if (identity.kind === 'provider' && identity.record) {
      return providerToTarget(identity.record, providerTypes)
    }
    if (identity.kind === 'webhook' && identity.record) return webhookToTarget(identity.record)
    return null
  }, [identity, providerTypes])

  const loadDeliveries = useCallback(async () => {
    if (!currentTarget) return
    setDeliveriesError(null)
    try {
      setDeliveries(await fetchTargetDeliveries(currentTarget))
    } catch (error) {
      setDeliveriesError(
        `Deliveries could not be loaded: ${error instanceof Error ? error.message : 'network error'}`
      )
    }
  }, [currentTarget])

  // The log loads the first time its tab is opened, and again after a test.
  const deliveriesWanted = useRef(false)
  useEffect(() => {
    if (tab === 'deliveries' && !deliveriesWanted.current) {
      deliveriesWanted.current = true
      void loadDeliveries()
    }
  }, [tab, loadDeliveries])

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
    if (errors[key as string]) setErrors(({ [key as string]: _, ...rest }) => rest)
  }

  // ---- title --------------------------------------------------------------

  const typeLabel =
    identity.kind === 'provider'
      ? providerLabel(identity.type, providerTypes)
      : identity.preset
        ? WEBHOOK_PRESETS[identity.preset].name
        : (currentTarget?.typeLabel ?? 'Webhook')
  const title = exists ? baseline.name || typeLabel : `Add ${typeLabel}`
  const presetId =
    identity.kind === 'webhook'
      ? (identity.preset ??
        (identity.record ? detectPreset(identity.record.url, identity.record.name) : null))
      : null
  const description =
    identity.kind === 'provider'
      ? 'Push messages about the events you pick below.'
      : presetId && presetId !== 'custom'
        ? WEBHOOK_PRESETS[presetId].description
        : 'Calls a URL with a JSON body describing each event.'

  // ---- request bodies -----------------------------------------------------

  const buildBody = (): { body: Record<string, unknown> } | { errors: Record<string, string> } => {
    const found: Record<string, string> = {}
    if (!draft.name.trim()) found.name = 'Give it a name to tell it apart in the list.'

    if (identity.kind === 'provider') {
      const stored = identity.record?.settings ?? {}
      const settings: Record<string, unknown> = { ...stored }
      for (const field of fields) {
        const value = draft.settings[field.name]
        if (field.type === 'boolean') {
          settings[field.name] = value === true
          continue
        }
        const text = typeof value === 'string' ? value.trim() : ''
        if (text === '' && isMasked(stored[field.name])) {
          // Left blank: keep the stored secret (the server swaps the mask back).
          settings[field.name] = stored[field.name]
          continue
        }
        if (text === '') {
          delete settings[field.name]
          if (field.required) found[`settings.${field.name}`] = `${field.label} is required.`
          continue
        }
        if (field.type === 'number') {
          const number = Number(text)
          if (!Number.isFinite(number)) {
            found[`settings.${field.name}`] = `${field.label} must be a number.`
            continue
          }
          settings[field.name] = number
        } else {
          if (field.type === 'url' && !validUrl(text)) {
            found[`settings.${field.name}`] = 'Include the scheme, for example https://…'
          }
          settings[field.name] = text
        }
      }
      return Object.keys(found).length > 0
        ? { errors: found }
        : {
            body: {
              name: draft.name.trim(),
              type: identity.type,
              enabled: draft.enabled,
              settings,
              ...draft.events,
              ...draft.media,
            },
          }
    }

    // Webhook
    const headers: Record<string, string> = {}
    for (const row of draft.headers) {
      if (row.name.trim()) headers[row.name.trim()] = row.value
    }
    let url = draft.url.trim()
    const preset =
      !exists && identity.preset && identity.preset !== 'custom'
        ? WEBHOOK_PRESETS[identity.preset]
        : null
    let allHeaders = headers
    if (preset) {
      for (const field of preset.fields) {
        const value = (draft.presetValues[field.name] ?? '').trim()
        if (field.required && !value) found[`preset.${field.name}`] = `${field.label} is required.`
        else if (field.type === 'url' && value && !validUrl(value)) {
          found[`preset.${field.name}`] = 'Include the scheme, for example http://…'
        }
      }
      url = preset.buildUrl(draft.presetValues)
      // The preset's own headers (Kodi's Basic auth) first; a row typed under Advanced wins.
      allHeaders = { ...(preset.headers?.(draft.presetValues) ?? {}), ...headers }
    } else if (!url) {
      found.url = 'A URL is required.'
    } else if (!validUrl(url)) {
      found.url = 'Include the scheme, for example https://…'
    }
    if (draft.payloadTemplate.trim() && draft.method === 'GET') {
      found.payloadTemplate =
        'GET requests carry no body. Pick POST, PUT or PATCH to use a template.'
    }

    return Object.keys(found).length > 0
      ? { errors: found }
      : {
          body: {
            name: draft.name.trim(),
            url,
            method: draft.method,
            enabled: draft.enabled,
            headers: allHeaders,
            payloadTemplate: draft.payloadTemplate.trim() ? draft.payloadTemplate : null,
            ...draft.events,
          },
        }
  }

  /** Save without closing. Returns the stored target, or null when it did not save. */
  const persist = async (): Promise<Target | null> => {
    const built = buildBody()
    if ('errors' in built) {
      setErrors(built.errors)
      setTab('settings')
      return null
    }
    setErrors({})
    setSaving(true)
    try {
      const url = targetPath(identity.kind, identity.record?.id)
      const method = exists ? 'PUT' : 'POST'
      if (identity.kind === 'provider') {
        const record = await requestJson<ProviderRecord>(url, {
          method,
          body: JSON.stringify(built.body),
        })
        setIdentity({ kind: 'provider', type: record.type, record })
        onChanged()
        return providerToTarget(record, providerTypes)
      }
      const record = await requestJson<WebhookRecord>(url, {
        method,
        body: JSON.stringify(built.body),
      })
      setIdentity({ kind: 'webhook', preset: null, record })
      onChanged()
      return webhookToTarget(record)
    } catch (error) {
      toast.error(exists ? 'Changes not saved' : 'Target not added', {
        description: error instanceof Error ? error.message : 'Hamster is unreachable.',
      })
      return null
    } finally {
      setSaving(false)
    }
  }

  const save = async () => {
    const wasNew = !exists
    const saved = await persist()
    if (!saved) return
    toast.success(wasNew ? `${saved.name} added` : `${saved.name} saved`)
    onOpenChange(false)
  }

  const test = async () => {
    let target = currentTarget
    if (!target || dirty) {
      target = await persist()
      if (!target) return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const result = await requestJson<TestResult>(`${targetPath(target.kind, target.id)}/test`, {
        method: 'POST',
      })
      setTestResult(result)
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Hamster is unreachable.',
      })
    } finally {
      setTesting(false)
      onChanged()
      if (deliveriesWanted.current) void loadDeliveries()
    }
  }

  const askDelete = () => {
    if (!currentTarget) return
    const target = currentTarget
    confirmDialog.confirm({
      title: `Delete ${target.name}?`,
      description:
        target.kind === 'provider'
          ? 'The target, its stored credentials and its delivery log are removed. Nothing more is sent through it.'
          : 'The endpoint and its delivery log are removed. A media server refreshed this way stops rescanning on import.',
      confirmLabel: 'Delete',
      loadingLabel: 'Deleting',
      onConfirm: async () => {
        try {
          await requestJson(targetPath(target.kind, target.id), { method: 'DELETE' })
          toast.success(`${target.name} deleted`)
          onChanged()
          onOpenChange(false)
        } catch (error) {
          toast.error(`${target.name} not deleted`, {
            description: error instanceof Error ? error.message : 'Hamster is unreachable.',
          })
        }
      },
    })
  }

  const askClearDeliveries = () => {
    if (!currentTarget) return
    const target = currentTarget
    confirmDialog.confirm({
      title: `Clear deliveries for ${target.name}?`,
      description: 'The delivery log for this target is emptied. The target itself is kept.',
      confirmLabel: 'Clear',
      loadingLabel: 'Clearing',
      onConfirm: async () => {
        try {
          await clearTargetDeliveries(target)
          setDeliveries([])
          onChanged()
        } catch (error) {
          toast.error('Deliveries not cleared', {
            description: error instanceof Error ? error.message : 'Hamster is unreachable.',
          })
        }
      },
    })
  }

  // ---- render -------------------------------------------------------------

  const settingsBody = (
    <div className="space-y-8 px-6 pb-6">
      <SheetSection title="Connection">
        <SheetField label="Name" error={errors.name}>
          {(props) => (
            <Input
              {...props}
              value={draft.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder={identity.kind === 'provider' ? `My ${typeLabel}` : 'Plex refresh'}
            />
          )}
        </SheetField>

        {identity.kind === 'provider' && (
          <ProviderFields
            fields={fields}
            loading={!providerType}
            stored={identity.record?.settings ?? {}}
            values={draft.settings}
            errors={errors}
            onChange={(name, value) => {
              update('settings', { ...draft.settings, [name]: value })
              if (errors[`settings.${name}`]) {
                setErrors(({ [`settings.${name}`]: _, ...rest }) => rest)
              }
            }}
          />
        )}

        {identity.kind === 'webhook' && (
          <WebhookFields
            draft={draft}
            preset={!exists && identity.preset ? identity.preset : null}
            errors={errors}
            update={update}
            clearError={(key) => setErrors(({ [key]: _, ...rest }) => rest)}
          />
        )}

        <div className="flex items-center justify-between gap-4">
          <label htmlFor={enabledId} className="text-sm">
            Enabled
            <span className="block text-xs text-muted-foreground">
              Off keeps the settings but sends nothing.
            </span>
          </label>
          <Switch
            id={enabledId}
            checked={draft.enabled}
            onCheckedChange={(checked) => update('enabled', checked)}
          />
        </div>
      </SheetSection>

      <SheetSection title="Events">
        <EventPicker value={draft.events} onChange={(events) => update('events', events)} />
      </SheetSection>

      <SheetSection title="Media types">
        {identity.kind === 'provider' ? (
          <>
            <p className="text-xs text-muted-foreground">
              Events about unticked types are dropped before this target sees them.
            </p>
            <MediaPicker value={draft.media} onChange={(media) => update('media', media)} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Not supported for webhooks yet: every media type fires.
          </p>
        )}
      </SheetSection>

      {identity.kind === 'webhook' && (
        <AdvancedSection draft={draft} errors={errors} update={update} />
      )}

      {testResult && <TestOutcome result={testResult} kind={identity.kind} />}
    </div>
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={EDITOR_SHEET_CLASS}>
        <SheetHeader className="pr-14 pb-4">
          <SheetTitle className="truncate">{title}</SheetTitle>
          <SheetDescription>
            <span className="font-medium text-foreground">{typeLabel}</span> · {description}
          </SheetDescription>
        </SheetHeader>

        {exists ? (
          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as 'settings' | 'deliveries')}
            className="min-h-0 flex-1 gap-0"
          >
            <div className="border-b border-border px-6">
              <TabsList className="h-10 gap-4 rounded-none bg-transparent p-0">
                {(['settings', 'deliveries'] as const).map((value) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="relative h-10 flex-none rounded-none border-0 px-0.5 text-muted-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent hover:text-foreground data-[active]:bg-transparent data-[active]:text-foreground data-[active]:after:bg-primary"
                  >
                    {value === 'settings' ? 'Settings' : 'Deliveries'}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <TabsContent value="settings" className="min-h-0">
              <SheetBody className="h-full">{settingsBody}</SheetBody>
            </TabsContent>
            <TabsContent value="deliveries" className="min-h-0">
              <SheetBody className="h-full">
                <div className="space-y-3 px-6 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                      The last 50 attempts, failures first.
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={askClearDeliveries}
                      disabled={!deliveries || deliveries.length === 0}
                    >
                      Clear
                    </Button>
                  </div>
                  <DeliveryLog
                    deliveries={deliveries}
                    error={deliveriesError}
                    onRetry={() => void loadDeliveries()}
                    empty="Nothing sent yet. Test sends one."
                  />
                </div>
              </SheetBody>
            </TabsContent>
          </Tabs>
        ) : (
          <SheetBody>{settingsBody}</SheetBody>
        )}

        <SheetFooter className="flex-row flex-wrap items-center gap-2">
          {exists && (
            <Button
              variant="ghost"
              size="sm"
              onClick={askDelete}
              disabled={busy}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <HugeiconsIcon icon={Delete01Icon} aria-hidden="true" />
              Delete
            </Button>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void test()} disabled={busy}>
              {testing ? <Spinner /> : <HugeiconsIcon icon={FlashIcon} aria-hidden="true" />}
              {!exists || dirty ? 'Save & test' : 'Test'}
            </Button>
            <Button size="sm" onClick={() => void save()} disabled={busy || (exists && !dirty)}>
              {saving && <Spinner />}
              {exists ? 'Save' : 'Add'}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
      <ConfirmDialog
        state={confirmDialog.state}
        close={confirmDialog.close}
        loading={confirmDialog.loading}
        handleConfirm={confirmDialog.handleConfirm}
      />
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** A section of the editor, its heading sticky while its fields scroll past. */
function ProviderFields({
  fields,
  loading,
  stored,
  values,
  errors,
  onChange,
}: {
  fields: readonly ProviderField[]
  loading: boolean
  stored: Record<string, unknown>
  values: Record<string, string | boolean>
  errors: Record<string, string>
  onChange: (name: string, value: string | boolean) => void
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading this service’s fields…</p>
  }
  return (
    <>
      {fields.map((field) => {
        if (field.type === 'boolean') {
          const id = `provider-${field.name}`
          return (
            <div key={field.name} className="flex items-center justify-between gap-4">
              <label htmlFor={id} className="text-sm font-medium">
                {sentenceCase(field.label)}
              </label>
              <Switch
                id={id}
                checked={values[field.name] === true}
                onCheckedChange={(checked) => onChange(field.name, checked)}
              />
            </div>
          )
        }
        const secretStored = isMasked(stored[field.name])
        const secret = field.type === 'password' || secretStored
        return (
          <SheetField
            key={field.name}
            label={sentenceCase(field.label)}
            optional={!field.required}
            error={errors[`settings.${field.name}`]}
            help={secretStored ? 'Stored. Leave blank to keep it, or type a new one.' : undefined}
          >
            {(props) => (
              <Input
                {...props}
                type={
                  secret
                    ? 'password'
                    : field.type === 'number'
                      ? 'number'
                      : field.type === 'email'
                        ? 'email'
                        : 'text'
                }
                inputMode={
                  field.type === 'number' ? 'numeric' : field.type === 'url' ? 'url' : undefined
                }
                autoComplete={secret ? 'new-password' : 'off'}
                value={String(values[field.name] ?? '')}
                onChange={(e) => onChange(field.name, e.target.value)}
                placeholder={secretStored ? '••••••••' : (field.placeholder ?? '')}
                className={cn((field.type === 'url' || secret) && 'readout')}
              />
            )}
          </SheetField>
        )
      })}
    </>
  )
}

function WebhookFields({
  draft,
  preset,
  errors,
  update,
  clearError,
}: {
  draft: Draft
  preset: WebhookPresetId | null
  errors: Record<string, string>
  update: <K extends keyof Draft>(key: K, value: Draft[K]) => void
  clearError: (key: string) => void
}) {
  const presetDef = preset && preset !== 'custom' ? WEBHOOK_PRESETS[preset] : null

  return (
    <>
      {presetDef ? (
        presetDef.fields.map((field) => (
          <SheetField
            key={field.name}
            label={field.label}
            help={field.help}
            optional={!field.required}
            error={errors[`preset.${field.name}`]}
          >
            {(props) => (
              <Input
                {...props}
                type={field.type === 'password' ? 'password' : 'text'}
                inputMode={field.type === 'url' ? 'url' : undefined}
                autoComplete={field.type === 'password' ? 'new-password' : 'off'}
                value={draft.presetValues[field.name] ?? ''}
                onChange={(e) => {
                  update('presetValues', { ...draft.presetValues, [field.name]: e.target.value })
                  clearError(`preset.${field.name}`)
                }}
                placeholder={field.placeholder}
                className="readout"
              />
            )}
          </SheetField>
        ))
      ) : (
        <SheetField
          label="URL"
          error={errors.url}
          help={
            draft.url.includes(MASK)
              ? 'Parts shown as **** are stored secrets. Leave them as they are to keep them.'
              : 'Must be reachable from the Hamster server, not from your browser.'
          }
        >
          {(props) => (
            <Input
              {...props}
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={draft.url}
              onChange={(e) => update('url', e.target.value)}
              placeholder="https://example.com/hooks/hamster"
              className="readout"
            />
          )}
        </SheetField>
      )}

      <SheetField label="Method">
        {(props) => (
          <Select
            value={draft.method}
            onValueChange={(value) => update('method', value as WebhookMethod)}
          >
            <SelectTrigger id={props.id} className="w-full sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {METHODS.map((method) => (
                <SelectItem key={method} value={method}>
                  {method}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        )}
      </SheetField>
    </>
  )
}

function AdvancedSection({
  draft,
  errors,
  update,
}: {
  draft: Draft
  errors: Record<string, string>
  update: <K extends keyof Draft>(key: K, value: Draft[K]) => void
}) {
  const [open, setOpen] = useState(
    () => draft.headers.length > 0 || draft.payloadTemplate.trim() !== ''
  )
  const panelId = useId()
  const templateId = useId()

  const setHeader = (id: number, patch: Partial<HeaderRow>) =>
    update(
      'headers',
      draft.headers.map((row) => (row.id === id ? { ...row, ...patch } : row))
    )

  return (
    <section className="space-y-4">
      <h4 className="-mx-6 border-b border-border px-6">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-2 pt-4 pb-2 text-left text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Advanced
          <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
            Headers, body template
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              aria-hidden="true"
              className={cn('size-4 transition-transform duration-200', open && 'rotate-180')}
            />
          </span>
        </button>
      </h4>

      {open && (
        <div id={panelId} className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">Headers</p>
            {draft.headers.length === 0 && (
              <p className="text-xs text-muted-foreground">
                None. Hamster always sends User-Agent and X-Hamster-Event.
              </p>
            )}
            {draft.headers.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[10rem_1fr_auto]"
              >
                <Input
                  aria-label="Header name"
                  value={row.name}
                  onChange={(e) => setHeader(row.id, { name: e.target.value })}
                  placeholder="Authorization"
                  className="readout col-span-1"
                  autoComplete="off"
                />
                <Input
                  aria-label={`Value of ${row.name || 'header'}`}
                  value={row.value}
                  onChange={(e) => setHeader(row.id, { value: e.target.value })}
                  placeholder="Bearer …"
                  className="readout order-3 col-span-2 sm:order-none sm:col-span-1"
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${row.name || 'header'}`}
                  onClick={() =>
                    update(
                      'headers',
                      draft.headers.filter((r) => r.id !== row.id)
                    )
                  }
                >
                  <HugeiconsIcon icon={Cancel01Icon} aria-hidden="true" />
                </Button>
              </div>
            ))}
            {draft.headers.some((row) => row.value === MASK) && (
              <p className="text-xs text-muted-foreground">
                **** is a stored value. Leave it to keep it.
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                update('headers', [...draft.headers, { id: ++headerRowId, name: '', value: '' }])
              }
            >
              <HugeiconsIcon icon={Add01Icon} aria-hidden="true" />
              Add header
            </Button>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={templateId} className="block text-sm font-medium">
              Body template <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id={templateId}
              value={draft.payloadTemplate}
              onChange={(e) => update('payloadTemplate', e.target.value)}
              rows={5}
              spellCheck={false}
              aria-invalid={errors.payloadTemplate ? true : undefined}
              placeholder='{"text": "{{eventType}}: {{media.title}}"}'
              className="readout w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
            />
            {errors.payloadTemplate ? (
              <p className="text-xs text-destructive">{errors.payloadTemplate}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Replaces the JSON body. <code className="readout">{'{{field}}'}</code> and{' '}
                <code className="readout">{'{{media.title}}'}</code> are filled from the event.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">Default body</p>
            <p className="text-xs text-muted-foreground">
              Sent when there is no template. Only eventType and the media block change.
            </p>
            <pre className="readout max-h-64 overflow-auto rounded-md border border-border bg-muted/50 p-3 text-xs">
              {EXAMPLE_PAYLOAD}
            </pre>
          </div>
        </div>
      )}
    </section>
  )
}

function TestOutcome({ result, kind }: { result: TestResult; kind: 'provider' | 'webhook' }) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-2 rounded-lg border p-3 text-sm',
        result.success
          ? 'border-status-complete/40 bg-status-complete/10'
          : 'border-destructive/40 bg-destructive/10'
      )}
    >
      <HugeiconsIcon
        icon={result.success ? CheckmarkCircle02Icon : Cancel01Icon}
        aria-hidden="true"
        className={cn(
          'mt-0.5 size-4 shrink-0',
          result.success ? 'text-status-complete-ink' : 'text-destructive'
        )}
      />
      <span className="min-w-0 break-words text-foreground">
        {result.success ? (
          kind === 'webhook' ? (
            <>
              Endpoint answered <span className="readout">HTTP {result.statusCode}</span>.
            </>
          ) : (
            'Test message sent. If nothing arrived, the credentials work but the destination is wrong.'
          )
        ) : (
          <>
            {result.statusCode ? (
              <span className="readout">HTTP {result.statusCode} · </span>
            ) : null}
            {result.error ||
              (kind === 'webhook'
                ? 'The endpoint did not accept the request.'
                : 'The service did not accept the message.')}
          </>
        )}
      </span>
    </div>
  )
}

/** "SMTP Host" → "SMTP host", "Use SSL/TLS" stays; acronyms keep their case. */
function sentenceCase(label: string): string {
  return label
    .split(' ')
    .map((word, index) => (index === 0 || /[A-Z]{2,}|\//.test(word) ? word : word.toLowerCase()))
    .join(' ')
}
