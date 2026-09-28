import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link } from '@inertiajs/react'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import {
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Key01Icon,
  Tick02Icon,
  ViewIcon,
  ViewOffIcon,
} from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StatusBadge } from '@/components/status-badge'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Auto-save
// ---------------------------------------------------------------------------

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/** How long the muted "Saved" tick stays after a successful auto-save. */
export const SAVED_TICK_MS = 1500

/** The words a failed save shows in its row. */
export function saveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return "Couldn't save. Try again."
}

/**
 * Optimistic auto-save for a single value (a switch, a select).
 *
 * The control shows the new value immediately and `onSave` persists it. On
 * success a "Saved" tick shows for 1.5s; on failure the control reverts to
 * `value` and the row shows why. The optimistic value is held until the
 * caller's `value` catches up, so there is no flash back to the old state
 * between the request finishing and the parent re-rendering. Only the latest
 * of several rapid changes decides the outcome.
 */
export function useAutoSave<T>(value: T, onSave: (next: T) => unknown) {
  const [optimistic, setOptimistic] = useState<{ value: T } | null>(null)
  const [status, setStatus] = useState<AutoSaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const sequence = useRef(0)
  const tickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(tickTimer.current)
    }
  }, [])

  // The parent's value moved (it caught up, or something else changed it): it wins.
  useEffect(() => {
    setOptimistic(null)
  }, [value])

  const commit = useCallback(
    async (next: T) => {
      const id = ++sequence.current
      clearTimeout(tickTimer.current)
      setOptimistic({ value: next })
      setStatus('saving')
      setError(null)
      try {
        await onSave(next)
        if (!mounted.current || id !== sequence.current) return
        setStatus('saved')
        tickTimer.current = setTimeout(() => {
          if (mounted.current) setStatus('idle')
        }, SAVED_TICK_MS)
      } catch (err) {
        if (!mounted.current || id !== sequence.current) return
        setOptimistic(null)
        setStatus('error')
        setError(saveErrorMessage(err))
      }
    },
    [onSave]
  )

  return {
    value: optimistic ? optimistic.value : value,
    commit,
    status,
    error,
    saving: status === 'saving',
  }
}

function SavedTick({ status }: { status: AutoSaveStatus }) {
  return (
    <span aria-live="polite" className="inline-flex items-center">
      {status === 'saved' && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <HugeiconsIcon icon={Tick02Icon} aria-hidden="true" className="size-3.5" />
          Saved
        </span>
      )}
    </span>
  )
}

// ---------------------------------------------------------------------------
// The row
// ---------------------------------------------------------------------------

interface SettingRowProps {
  label: ReactNode
  /** One line. Longer help goes behind an info popover. */
  description?: ReactNode
  /** The control on the right. */
  control?: ReactNode
  /** Stack the control full width under the label below md (selects, inputs). */
  stack?: boolean
  /** Inline after the label — the Saved tick. */
  status?: ReactNode
  /** Destructive text inside the row: a failed save, an invalid value. */
  error?: ReactNode
  /** Associates the label with a native control. */
  htmlFor?: string
  labelId?: string
  descriptionId?: string
  className?: string
  children?: ReactNode
}

/**
 * The shared anatomy of every settings row: label and one line of description
 * on the left, the control on the right. The variants below fill it in.
 */
export function SettingRow({
  label,
  description,
  control,
  stack = false,
  status,
  error,
  htmlFor,
  labelId,
  descriptionId,
  className,
  children,
}: SettingRowProps) {
  const LabelTag = htmlFor ? 'label' : 'span'

  return (
    <div
      data-slot="setting-row"
      className={cn(
        'flex min-h-14 gap-x-6 gap-y-2 px-4 py-3',
        stack
          ? 'flex-col md:flex-row md:items-center md:justify-between'
          : 'items-center justify-between',
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2">
          <LabelTag id={labelId} htmlFor={htmlFor} className="text-sm font-medium">
            {label}
          </LabelTag>
          {status}
        </div>
        {description && (
          <p id={descriptionId} className="text-sm text-muted-foreground">
            {description}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-0.5 text-sm text-destructive">
            {error}
          </p>
        )}
        {children}
      </div>
      {control && (
        <div
          className={cn(
            'flex shrink-0 items-center gap-2',
            stack && 'w-full md:w-auto [&>*]:w-full md:[&>*]:w-auto'
          )}
        >
          {control}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toggle — auto-saves
// ---------------------------------------------------------------------------

interface ToggleRowProps {
  label: ReactNode
  description?: ReactNode
  checked: boolean
  /** Persist the new value. Throw (or reject) to revert the switch and show why. */
  onSave: (checked: boolean) => unknown
  disabled?: boolean
  className?: string
}

export function ToggleRow({
  label,
  description,
  checked,
  onSave,
  disabled,
  className,
}: ToggleRowProps) {
  const ids = useRowIds()
  const save = useAutoSave(checked, onSave)

  return (
    <SettingRow
      label={label}
      description={description}
      labelId={ids.label}
      descriptionId={description ? ids.description : undefined}
      status={<SavedTick status={save.status} />}
      error={save.error}
      className={className}
      control={
        <Switch
          checked={save.value}
          onCheckedChange={(next) => void save.commit(next)}
          disabled={disabled}
          aria-labelledby={ids.label}
          aria-describedby={description ? ids.description : undefined}
          aria-busy={save.saving || undefined}
        />
      }
    />
  )
}

// ---------------------------------------------------------------------------
// Select — auto-saves
// ---------------------------------------------------------------------------

export interface SelectRowOption {
  value: string
  label: string
}

interface SelectRowProps {
  label: ReactNode
  description?: ReactNode
  value: string
  options: readonly SelectRowOption[]
  /** Persist the new value. Throw (or reject) to revert and show why. */
  onSave: (value: string) => unknown
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Width of the trigger from md up. */
  triggerClassName?: string
}

export function SelectRow({
  label,
  description,
  value,
  options,
  onSave,
  placeholder = 'Select…',
  disabled,
  className,
  triggerClassName,
}: SelectRowProps) {
  const ids = useRowIds()
  const save = useAutoSave(value, onSave)

  return (
    <SettingRow
      stack
      label={label}
      description={description}
      htmlFor={ids.control}
      descriptionId={description ? ids.description : undefined}
      status={<SavedTick status={save.status} />}
      error={save.error}
      className={className}
      control={
        <Select
          value={save.value}
          onValueChange={(next) => {
            if (next != null && String(next) !== save.value) void save.commit(String(next))
          }}
          disabled={disabled}
        >
          <SelectTrigger
            id={ids.control}
            className={cn('w-full md:w-56', triggerClassName)}
            aria-describedby={description ? ids.description : undefined}
            aria-busy={save.saving || undefined}
          >
            <SelectValue>
              {(selected: string) =>
                options.find((option) => option.value === selected)?.label ?? placeholder
              }
            </SelectValue>
          </SelectTrigger>
          <SelectPopup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      }
    />
  )
}

// ---------------------------------------------------------------------------
// Field — typed input, never auto-saves (pair with SaveBar + useFormDraft)
// ---------------------------------------------------------------------------

interface FieldRowProps extends Omit<
  ComponentProps<'input'>,
  'value' | 'onChange' | 'children' | 'className'
> {
  label: ReactNode
  description?: ReactNode
  value: string | number | null | undefined
  onChange: (value: string) => void
  /** Validation message; marks the input invalid. */
  error?: ReactNode
  /** A unit after the input: "GB", "min". */
  suffix?: ReactNode
  /** Set the value in the Readout face (paths, patterns, numbers). */
  mono?: boolean
  className?: string
  inputClassName?: string
}

export function FieldRow({
  label,
  description,
  value,
  onChange,
  error,
  suffix,
  mono = false,
  className,
  inputClassName,
  id,
  ...inputProps
}: FieldRowProps) {
  const ids = useRowIds()
  const inputId = id ?? ids.control
  const errorId = `${ids.description}-error`

  return (
    <SettingRow
      stack
      label={label}
      description={description}
      htmlFor={inputId}
      descriptionId={description ? ids.description : undefined}
      error={error ? <span id={errorId}>{error}</span> : undefined}
      className={className}
      control={
        <div className="flex items-center gap-2">
          <Input
            id={inputId}
            value={value ?? ''}
            onChange={(event) => onChange(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={
              [description ? ids.description : null, error ? errorId : null]
                .filter(Boolean)
                .join(' ') || undefined
            }
            className={cn('w-full md:w-56', mono && 'readout', inputClassName)}
            {...inputProps}
          />
          {suffix && <span className="shrink-0 text-sm text-muted-foreground">{suffix}</span>}
        </div>
      }
    />
  )
}

// ---------------------------------------------------------------------------
// Credential — the value is never shown
// ---------------------------------------------------------------------------

interface CredentialDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Sentence case: "Add TMDB API key". */
  title: string
  /** Where to get one, what it unlocks. */
  description?: ReactNode
  inputLabel: string
  placeholder?: string
  /** Persist the new value. Throw (or reject) to keep the dialog open and show why. */
  onSave: (value: string) => unknown
  /** Offered when a value is already stored. */
  onRemove?: () => unknown
  /** Return a message to block saving. */
  validate?: (value: string) => string | null
}

/**
 * Single-field entry for a secret. Shared by CredentialRow and inline
 * affordances such as "Needs TMDB key · Add".
 */
export function CredentialDialog({
  open,
  onOpenChange,
  title,
  description,
  inputLabel,
  placeholder,
  onSave,
  onRemove,
  validate,
}: CredentialDialogProps) {
  const ids = useRowIds()
  const [value, setValue] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Every opening starts blank: the stored value is never sent back to the page.
  useEffect(() => {
    if (open) {
      setValue('')
      setRevealed(false)
      setError(null)
      setBusy(null)
    }
  }, [open])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const trimmed = value.trim()
    const problem = trimmed ? (validate?.(trimmed) ?? null) : `${inputLabel} is empty.`
    if (problem) {
      setError(problem)
      return
    }
    setBusy('save')
    setError(null)
    try {
      await onSave(trimmed)
      onOpenChange(false)
    } catch (err) {
      setError(saveErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!onRemove || busy) return
    setBusy('remove')
    setError(null)
    try {
      await onRemove()
      onOpenChange(false)
    } catch (err) {
      setError(saveErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent
        aria-labelledby={ids.label}
        aria-describedby={description ? ids.description : undefined}
      >
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle id={ids.label}>{title}</DialogTitle>
            {description && (
              <DialogDescription id={ids.description}>{description}</DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor={ids.control} className="text-sm font-medium">
              {inputLabel}
            </label>
            <div className="flex items-center gap-2">
              <Input
                id={ids.control}
                type={revealed ? 'text' : 'password'}
                value={value}
                onChange={(event) => {
                  setValue(event.target.value)
                  if (error) setError(null)
                }}
                placeholder={placeholder}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${ids.control}-error` : undefined}
                className="readout"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setRevealed((r) => !r)}
                aria-label={revealed ? 'Hide value' : 'Show value'}
                aria-pressed={revealed}
              >
                <HugeiconsIcon icon={revealed ? ViewOffIcon : ViewIcon} aria-hidden="true" />
              </Button>
            </div>
            {error && (
              <p id={`${ids.control}-error`} role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="sm:justify-between">
            {onRemove ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={remove}
                disabled={busy !== null}
              >
                {busy === 'remove' ? 'Removing…' : 'Remove'}
              </Button>
            ) : (
              <span className="hidden sm:block" />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={busy !== null}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy !== null}>
                {busy === 'save' ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface CredentialRowProps {
  /** Sentence case: "TMDB API key". */
  label: string
  description?: ReactNode
  /** Whether a value is stored. The value itself never reaches the page. */
  isSet: boolean
  /** Missing and required shows an amber "Missing"; optional shows a muted "Not set". */
  required?: boolean
  onSave: (value: string) => unknown
  onRemove?: () => unknown
  /** Dialog help: where to get one, what it unlocks. */
  help?: ReactNode
  placeholder?: string
  validate?: (value: string) => string | null
  className?: string
}

export function CredentialRow({
  label,
  description,
  isSet,
  required = true,
  onSave,
  onRemove,
  help,
  placeholder,
  validate,
  className,
}: CredentialRowProps) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<AutoSaveStatus>('idle')
  const tickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(tickTimer.current), [])

  const flashSaved = () => {
    clearTimeout(tickTimer.current)
    setStatus('saved')
    tickTimer.current = setTimeout(() => setStatus('idle'), SAVED_TICK_MS)
  }

  const verb = isSet ? 'Replace' : 'Add'

  return (
    <>
      <SettingRow
        label={label}
        description={description}
        status={<SavedTick status={status} />}
        className={className}
        control={
          <>
            {isSet ? (
              <StatusBadge tone="neutral" label="Set" icon={CheckmarkCircle02Icon} />
            ) : required ? (
              <StatusBadge tone="warning" label="Missing" />
            ) : (
              <StatusBadge tone="neutral" label="Not set" icon={Key01Icon} />
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(true)}
              aria-label={`${verb} ${label}`}
            >
              {verb}
            </Button>
          </>
        }
      />
      <CredentialDialog
        open={open}
        onOpenChange={setOpen}
        title={`${verb} ${label}`}
        description={help}
        inputLabel={label}
        placeholder={placeholder}
        validate={validate}
        onSave={async (value) => {
          await onSave(value)
          flashSaved()
        }}
        onRemove={
          isSet && onRemove
            ? async () => {
                await onRemove()
                flashSaved()
              }
            : undefined
        }
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Readout — label | muted mono value
// ---------------------------------------------------------------------------

interface ReadoutRowProps {
  label: ReactNode
  description?: ReactNode
  value: ReactNode
  /** Set to false for prose values. */
  mono?: boolean
  className?: string
}

export function ReadoutRow({ label, description, value, mono = true, className }: ReadoutRowProps) {
  return (
    <SettingRow
      stack
      label={label}
      description={description}
      className={className}
      control={
        <span
          className={cn(
            'text-muted-foreground break-words md:max-w-sm md:text-right',
            mono ? 'readout text-xs' : 'text-sm'
          )}
        >
          {value}
        </span>
      }
    />
  )
}

// ---------------------------------------------------------------------------
// Link — label + chevron. Sparingly, never in place of a missing feature.
// ---------------------------------------------------------------------------

type LinkRowProps = {
  label: ReactNode
  description?: ReactNode
  /** A live status line under the label ("4 types · 1 folder unreachable"). */
  meta?: ReactNode
  /** Destructive when the thing the row leads to is failing. */
  metaTone?: 'muted' | 'error'
  icon?: IconSvgElement
  /** Trailing marker before the chevron, e.g. a StatusDot. */
  trailing?: ReactNode
  className?: string
} & (
  | { href: string; external?: boolean; onClick?: never }
  | { onClick: () => void; href?: never; external?: never }
)

export function LinkRow(props: LinkRowProps) {
  const { label, description, meta, metaTone = 'muted', icon, trailing, className } = props

  const classes = cn(
    'flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors',
    'hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset',
    className
  )

  const body = (
    <>
      {icon && (
        <HugeiconsIcon
          icon={icon}
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-sm text-muted-foreground">{description}</span>}
        {meta && (
          <span
            className={cn(
              'block truncate text-sm',
              metaTone === 'error' ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            {meta}
          </span>
        )}
      </span>
      {trailing}
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
      />
    </>
  )

  if (props.href !== undefined) {
    if (props.external) {
      return (
        <a
          data-slot="setting-row"
          href={props.href}
          target="_blank"
          rel="noreferrer"
          className={classes}
        >
          {body}
        </a>
      )
    }
    return (
      <Link data-slot="setting-row" href={props.href} className={classes}>
        {body}
      </Link>
    )
  }

  return (
    <button data-slot="setting-row" type="button" onClick={props.onClick} className={classes}>
      {body}
    </button>
  )
}

// ---------------------------------------------------------------------------

function useRowIds() {
  const base = useId()
  return {
    label: `${base}-label`,
    description: `${base}-description`,
    control: `${base}-control`,
  }
}
