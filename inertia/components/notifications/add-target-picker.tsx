import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import {
  Add01Icon,
  ArrowDown01Icon,
  DiscordIcon,
  Mail01Icon,
  Notification01Icon,
  SlackIcon,
  TelegramIcon,
  Tv01Icon,
  WebhookIcon,
} from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuItem,
  DropdownMenuPopup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { WEBHOOK_PRESETS, type ProviderType, type WebhookPresetId } from './targets'

export type AddChoice =
  | { kind: 'provider'; type: string }
  | { kind: 'webhook'; preset: WebhookPresetId }

const PROVIDER_ICONS: Record<string, IconSvgElement> = {
  discord: DiscordIcon,
  telegram: TelegramIcon,
  slack: SlackIcon,
  email: Mail01Icon,
}

/** The icon for a push type, an HTTP preset, or a media server refresh. */
export function targetIcon(choice: AddChoice): IconSvgElement {
  if (choice.kind === 'provider') return PROVIDER_ICONS[choice.type] ?? Notification01Icon
  return WEBHOOK_PRESETS[choice.preset].group === 'refresh' ? Tv01Icon : WebhookIcon
}

const HTTP_PRESETS: WebhookPresetId[] = ['custom', 'kodi']
const REFRESH_PRESETS: WebhookPresetId[] = ['plex', 'jellyfin', 'emby']

interface AddTargetPickerProps {
  /** From /api/v1/notifications/types, so every push service the server knows is offered. */
  providerTypes: readonly ProviderType[]
  onSelect: (choice: AddChoice) => void
  disabled?: boolean
}

/**
 * "Add target": push services, HTTP endpoints, and (until Media servers ships)
 * the library-refresh presets, in one grouped menu.
 */
export function AddTargetPicker({ providerTypes, onSelect, disabled }: AddTargetPickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" disabled={disabled}>
          <HugeiconsIcon icon={Add01Icon} aria-hidden="true" />
          Add target
          <HugeiconsIcon icon={ArrowDown01Icon} aria-hidden="true" className="-mr-1 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuPopup align="end" className="w-72 max-w-[calc(100vw-2rem)]">
        <DropdownMenuGroup>
          <DropdownMenuGroupLabel>Push</DropdownMenuGroupLabel>
          {providerTypes.map((type) => (
            <DropdownMenuItem
              key={type.type}
              onClick={() => onSelect({ kind: 'provider', type: type.type })}
            >
              <HugeiconsIcon
                icon={targetIcon({ kind: 'provider', type: type.type })}
                aria-hidden="true"
              />
              {type.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuGroupLabel>HTTP</DropdownMenuGroupLabel>
          {HTTP_PRESETS.map((id) => (
            <PresetItem key={id} id={id} onSelect={onSelect} />
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuGroupLabel>Media server refresh</DropdownMenuGroupLabel>
          {REFRESH_PRESETS.map((id) => (
            <PresetItem key={id} id={id} onSelect={onSelect} />
          ))}
        </DropdownMenuGroup>
      </DropdownMenuPopup>
    </DropdownMenu>
  )
}

function PresetItem({
  id,
  onSelect,
}: {
  id: WebhookPresetId
  onSelect: (choice: AddChoice) => void
}) {
  const preset = WEBHOOK_PRESETS[id]
  return (
    <DropdownMenuItem
      onClick={() => onSelect({ kind: 'webhook', preset: id })}
      className="items-start"
    >
      <HugeiconsIcon
        icon={targetIcon({ kind: 'webhook', preset: id })}
        aria-hidden="true"
        className="mt-0.5"
      />
      <span className="min-w-0">
        <span className="block">{preset.name}</span>
        <span className="block text-xs text-muted-foreground">{preset.description}</span>
      </span>
    </DropdownMenuItem>
  )
}
