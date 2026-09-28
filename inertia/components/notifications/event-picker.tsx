import { useId } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import {
  EVENT_GROUPS,
  MEDIA_TYPES,
  type EventFlags,
  type EventKey,
  type MediaFlags,
  type MediaKey,
} from './event_catalog'

interface EventPickerProps {
  value: EventFlags
  onChange: (next: EventFlags) => void
  disabled?: boolean
}

/**
 * The nine events, grouped the way an operator thinks about them. One checkbox
 * per event with a line saying what it means; the group heading's box turns
 * the whole group on or off, so "all imports" is one click.
 */
export function EventPicker({ value, onChange, disabled }: EventPickerProps) {
  const baseId = useId()
  const set = (key: EventKey, on: boolean) => onChange({ ...value, [key]: on })

  return (
    <div className="space-y-5">
      {EVENT_GROUPS.map((group) => {
        const all = group.events.every((event) => value[event.key])
        const groupId = `${baseId}-${group.id}`
        return (
          <fieldset key={group.id} className="space-y-2" disabled={disabled}>
            <legend className="sr-only">{group.label}</legend>
            <div className="flex items-center gap-2">
              <Checkbox
                id={groupId}
                checked={all}
                disabled={disabled}
                onCheckedChange={(checked) => {
                  const next = { ...value }
                  for (const event of group.events) next[event.key] = checked === true
                  onChange(next)
                }}
              />
              <label
                htmlFor={groupId}
                className="cursor-pointer text-xs font-medium text-muted-foreground select-none"
              >
                {group.label}
              </label>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 pl-6 sm:grid-cols-2">
              {group.events.map((event) => {
                const id = `${baseId}-${event.key}`
                return (
                  <div key={event.key} className="flex items-start gap-2">
                    <Checkbox
                      id={id}
                      checked={value[event.key]}
                      disabled={disabled}
                      onCheckedChange={(checked) => set(event.key, checked === true)}
                      aria-describedby={`${id}-description`}
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <label htmlFor={id} className="cursor-pointer text-sm select-none">
                        {event.label}
                      </label>
                      <p id={`${id}-description`} className="text-xs text-muted-foreground">
                        {event.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}

interface MediaPickerProps {
  value: MediaFlags
  onChange: (next: MediaFlags) => void
  disabled?: boolean
  className?: string
}

/** Which media types a push target hears about. */
export function MediaPicker({ value, onChange, disabled, className }: MediaPickerProps) {
  const baseId = useId()
  return (
    <fieldset
      className={cn('grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4', className)}
      disabled={disabled}
    >
      <legend className="sr-only">Media types</legend>
      {MEDIA_TYPES.map(({ key, label }) => {
        const id = `${baseId}-${key}`
        return (
          <div key={key} className="flex items-center gap-2">
            <Checkbox
              id={id}
              checked={value[key]}
              disabled={disabled}
              onCheckedChange={(checked) =>
                onChange({ ...value, [key as MediaKey]: checked === true })
              }
            />
            <label htmlFor={id} className="cursor-pointer text-sm select-none">
              {label}
            </label>
          </div>
        )
      })}
    </fieldset>
  )
}
