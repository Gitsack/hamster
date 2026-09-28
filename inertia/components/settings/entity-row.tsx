import { useId, useState, type ReactNode } from 'react'
import { Link } from '@inertiajs/react'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { ArrowRight01Icon, MoreHorizontalIcon } from '@hugeicons/core-free-icons'
import { Button, buttonVariants } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuPopup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAutoSave } from './setting-row'
import { cn } from '@/lib/utils'

export interface EntityRowAction {
  label: string
  icon?: IconSvgElement
  onSelect: () => unknown
  /** Red, and separated from the safe actions above it. */
  destructive?: boolean
  disabled?: boolean
  /** Ask first, in an AlertDialog. Required in spirit for anything destructive. */
  confirm?: {
    title: string
    description?: ReactNode
    confirmLabel?: string
  }
}

type EntityRowProps = {
  /** The entity's name (font-medium). */
  name: ReactNode
  /** Leading icon: a HugeIcon or any node (a service logo). */
  icon?: IconSvgElement | ReactNode
  /** A StatusBadge beside the name. */
  status?: ReactNode
  /** Line 2, in the Readout face. Arrays are joined with " · ", falsy parts dropped. */
  meta?: ReactNode | ReadonlyArray<ReactNode>
  /** The failure, in destructive ink under the meta line. */
  error?: ReactNode
  /** Show an inline Enabled switch. */
  enabled?: boolean
  /** Persist the switch. Throw (or reject) to revert it and show why. */
  onEnabledChange?: (enabled: boolean) => unknown
  /** Accessible name of the switch; defaults to "Enabled". */
  enabledLabel?: string
  /** Show the switch but refuse changes — say why in `status` or `trailing`. */
  enabledDisabled?: boolean
  /** The ⋯ menu. */
  actions?: ReadonlyArray<EntityRowAction>
  /** Extra controls before the switch — a "Browse" link, a Test button. */
  trailing?: ReactNode
  className?: string
} & (
  | { onOpen: () => void; href?: never }
  | { href: string; onOpen?: never }
  | { onOpen?: undefined; href?: undefined }
)

function isIconSvg(icon: unknown): icon is IconSvgElement {
  return Array.isArray(icon)
}

function joinMeta(meta: ReactNode | ReadonlyArray<ReactNode>): ReactNode {
  if (!Array.isArray(meta)) return meta as ReactNode
  const parts = (meta as ReadonlyArray<ReactNode>).filter(
    (part) => part !== null && part !== undefined && part !== false && part !== ''
  )
  return parts.map((part, index) => (
    <span key={index}>
      {index > 0 && <span aria-hidden="true"> · </span>}
      {part}
    </span>
  ))
}

/**
 * One indexer, client, target, profile, user, task or backup.
 *
 *   [icon] Name  (status)                      [trailing] [switch] [⋯] ›
 *          mono meta · meta · meta
 *          error text
 *
 * The whole row opens the entity (a Sheet, or a page via `href`); the switch
 * and menu sit above that hit area so they never trigger it.
 */
export function EntityRow(props: EntityRowProps) {
  const {
    name,
    icon,
    status,
    meta,
    error,
    enabled,
    onEnabledChange,
    enabledLabel = 'Enabled',
    enabledDisabled = false,
    actions,
    trailing,
    className,
  } = props
  const titleId = useId()
  const hasSwitch = enabled !== undefined && onEnabledChange !== undefined
  const toggle = useAutoSave(enabled ?? false, onEnabledChange ?? noop)
  const [confirming, setConfirming] = useState<EntityRowAction | null>(null)

  const opens = props.onOpen !== undefined || props.href !== undefined
  const off = hasSwitch && !toggle.value
  const rowError = error ?? toggle.error

  const safeActions = actions?.filter((a) => !a.destructive) ?? []
  const destructiveActions = actions?.filter((a) => a.destructive) ?? []

  const runAction = (action: EntityRowAction) => {
    if (action.confirm) {
      setConfirming(action)
    } else {
      void action.onSelect()
    }
  }

  // The stretched hit area: the name is the real button/link, its ::after covers the row.
  const hitArea =
    "outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-[3px] focus-visible:after:ring-inset focus-visible:after:ring-ring/50"

  const nameClasses = cn(
    'min-w-0 max-w-full truncate text-left text-sm font-medium',
    off && 'text-muted-foreground'
  )
  let nameNode: ReactNode
  if (props.href !== undefined) {
    nameNode = (
      <Link href={props.href} id={titleId} className={cn(nameClasses, hitArea)}>
        {name}
      </Link>
    )
  } else if (props.onOpen !== undefined) {
    nameNode = (
      <button
        type="button"
        id={titleId}
        onClick={props.onOpen}
        className={cn(nameClasses, hitArea)}
      >
        {name}
      </button>
    )
  } else {
    nameNode = (
      <span id={titleId} className={nameClasses}>
        {name}
      </span>
    )
  }

  const metaNode = meta !== undefined && meta !== null ? joinMeta(meta) : null
  const hasMeta = Array.isArray(metaNode) ? metaNode.length > 0 : Boolean(metaNode)

  return (
    <div
      data-slot="entity-row"
      data-state={off ? 'off' : 'on'}
      className={cn(
        'relative flex min-h-14 items-center gap-3 px-4 py-3 transition-colors',
        opens && 'hover:bg-accent/60',
        className
      )}
    >
      {icon !== undefined && icon !== null && (
        <span
          aria-hidden="true"
          className={cn(
            'hidden size-8 shrink-0 items-center sm:flex justify-center rounded-md bg-muted text-muted-foreground [&>svg]:size-4',
            off && 'opacity-60'
          )}
        >
          {isIconSvg(icon) ? <HugeiconsIcon icon={icon} /> : (icon as ReactNode)}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          {nameNode}
          {status}
        </div>
        {hasMeta && <p className="readout truncate text-xs text-muted-foreground">{metaNode}</p>}
        {rowError && (
          <p role="alert" className="mt-0.5 line-clamp-2 text-xs text-destructive">
            {rowError}
          </p>
        )}
      </div>

      {(trailing || hasSwitch || (actions && actions.length > 0)) && (
        <div className="relative z-10 flex shrink-0 items-center gap-1">
          {trailing}
          {hasSwitch && (
            <Switch
              checked={toggle.value}
              onCheckedChange={(next) => void toggle.commit(next)}
              disabled={enabledDisabled}
              aria-label={enabledLabel}
              aria-describedby={titleId}
              aria-busy={toggle.saving || undefined}
              className="mx-1"
            />
          )}
          {actions && actions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="More actions"
                  aria-describedby={titleId}
                >
                  <HugeiconsIcon icon={MoreHorizontalIcon} aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuPopup align="end">
                {safeActions.map((action) => (
                  <DropdownMenuItem
                    key={action.label}
                    disabled={action.disabled}
                    onClick={() => runAction(action)}
                  >
                    {action.icon && <HugeiconsIcon icon={action.icon} aria-hidden="true" />}
                    {action.label}
                  </DropdownMenuItem>
                ))}
                {safeActions.length > 0 && destructiveActions.length > 0 && (
                  <DropdownMenuSeparator />
                )}
                {destructiveActions.map((action) => (
                  <DropdownMenuItem
                    key={action.label}
                    variant="destructive"
                    disabled={action.disabled}
                    onClick={() => runAction(action)}
                  >
                    {action.icon && <HugeiconsIcon icon={action.icon} aria-hidden="true" />}
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuPopup>
            </DropdownMenu>
          )}
        </div>
      )}

      {opens && (
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          aria-hidden="true"
          className="pointer-events-none size-4 shrink-0 text-muted-foreground"
        />
      )}

      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent aria-labelledby={`${titleId}-confirm`}>
          <AlertDialogHeader>
            <AlertDialogTitle id={`${titleId}-confirm`}>
              {confirming?.confirm?.title}
            </AlertDialogTitle>
            {confirming?.confirm?.description && (
              <AlertDialogDescription>{confirming.confirm.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirming?.destructive ? buttonVariants({ variant: 'destructive' }) : undefined
              }
              onClick={() => {
                if (confirming) void confirming.onSelect()
              }}
            >
              {confirming?.confirm?.confirmLabel ?? confirming?.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function noop() {}
