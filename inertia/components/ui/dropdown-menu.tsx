"use client"

import * as React from "react"
import { Menu as BaseMenu } from "@base-ui/react/menu"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// Context to share stable ID with child components for SSR hydration
const DropdownMenuIdContext = React.createContext<string | undefined>(undefined)

function DropdownMenu({
  children,
  ...props
}: React.ComponentProps<typeof BaseMenu.Root>) {
  const reactId = React.useId()

  return (
    <DropdownMenuIdContext.Provider value={reactId}>
      <BaseMenu.Root {...props}>
        {children}
      </BaseMenu.Root>
    </DropdownMenuIdContext.Provider>
  )
}

function DropdownMenuTrigger({
  asChild,
  children,
  id,
  ...props
}: React.ComponentProps<typeof BaseMenu.Trigger> & {
  asChild?: boolean
}) {
  const menuId = React.useContext(DropdownMenuIdContext)
  const triggerId = id || (menuId ? `${menuId}-trigger` : undefined)

  if (asChild && React.isValidElement(children)) {
    return (
      <BaseMenu.Trigger
        id={triggerId}
        {...props}
        render={(triggerProps) =>
          React.cloneElement(children, {
            ...triggerProps,
            ...children.props,
          })
        }
      />
    )
  }

  return (
    <BaseMenu.Trigger id={triggerId} data-slot="dropdown-menu-trigger" {...props}>
      {children}
    </BaseMenu.Trigger>
  )
}

const DropdownMenuPortal = BaseMenu.Portal

const DropdownMenuGroup = BaseMenu.Group

function DropdownMenuPositioner({
  className,
  ...props
}: React.ComponentProps<typeof BaseMenu.Positioner>) {
  return (
    <BaseMenu.Positioner
      data-slot="dropdown-menu-positioner"
      className={cn("outline-none z-50", className)}
      {...props}
    />
  )
}

function DropdownMenuPopup({
  className,
  sideOffset = 4,
  side,
  align,
  id,
  ...props
}: React.ComponentProps<typeof BaseMenu.Popup> & {
  sideOffset?: number
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
}) {
  const menuId = React.useContext(DropdownMenuIdContext)
  const popupId = id || (menuId ? `${menuId}-popup` : undefined)

  return (
    <DropdownMenuPortal>
      <DropdownMenuPositioner sideOffset={sideOffset} side={side} align={align}>
        <BaseMenu.Popup
          id={popupId}
          data-slot="dropdown-menu-popup"
          className={cn(
            "bg-popover text-popover-foreground z-50 max-h-[var(--available-height)] min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md",
            className
          )}
          {...props}
        />
      </DropdownMenuPositioner>
    </DropdownMenuPortal>
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof BaseMenu.Item> & {
  inset?: boolean
  variant?: "default" | "destructive"
  asChild?: boolean
}) {
  const itemClassName = cn(
    "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:data-[highlighted]:bg-destructive/10 dark:data-[variant=destructive]:data-[highlighted]:bg-destructive/20 data-[variant=destructive]:data-[highlighted]:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    className
  )

  if (asChild && React.isValidElement(children)) {
    return (
      <BaseMenu.Item
        data-slot="dropdown-menu-item"
        data-inset={inset}
        data-variant={variant}
        {...props}
        render={(itemProps) =>
          React.cloneElement(children, {
            ...itemProps,
            ...children.props,
            className: cn(itemClassName, children.props.className),
          })
        }
      />
    )
  }

  return (
    <BaseMenu.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={itemClassName}
      {...props}
    >
      {children}
    </BaseMenu.Item>
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  onCheckedChange,
  ...props
}: React.ComponentProps<typeof BaseMenu.CheckboxItem>) {
  return (
    <BaseMenu.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      checked={checked}
      onCheckedChange={onCheckedChange}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <BaseMenu.CheckboxItemIndicator>
          <CheckIcon className="size-4" />
        </BaseMenu.CheckboxItemIndicator>
      </span>
      {children}
    </BaseMenu.CheckboxItem>
  )
}

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof BaseMenu.RadioGroup>) {
  return (
    <BaseMenu.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseMenu.RadioItem>) {
  return (
    <BaseMenu.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <BaseMenu.RadioItemIndicator>
          <CircleIcon className="size-2 fill-current" />
        </BaseMenu.RadioItemIndicator>
      </span>
      {children}
    </BaseMenu.RadioItem>
  )
}

function DropdownMenuGroupLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof BaseMenu.GroupLabel> & {
  inset?: boolean
}) {
  return (
    <BaseMenu.GroupLabel
      data-slot="dropdown-menu-group-label"
      data-inset={inset}
      className={cn(
        "px-2 py-1.5 text-sm font-medium data-[inset]:pl-8",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof BaseMenu.Separator>) {
  return (
    <BaseMenu.Separator
      data-slot="dropdown-menu-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "text-muted-foreground ml-auto text-xs tracking-widest",
        className
      )}
      {...props}
    />
  )
}

const DropdownMenuSub = BaseMenu.Root

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof BaseMenu.SubmenuTrigger> & {
  inset?: boolean
}) {
  return (
    <BaseMenu.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[popup-open]:bg-accent data-[popup-open]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4" />
    </BaseMenu.SubmenuTrigger>
  )
}

function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof BaseMenu.Popup>) {
  return (
    <DropdownMenuPortal>
      <DropdownMenuPositioner>
        <BaseMenu.Popup
          data-slot="dropdown-menu-sub-content"
          className={cn(
            "bg-popover text-popover-foreground z-50 min-w-[8rem] overflow-hidden rounded-md border p-1 shadow-lg",
            className
          )}
          {...props}
        />
      </DropdownMenuPositioner>
    </DropdownMenuPortal>
  )
}

// Backward compatibility aliases
const DropdownMenuContent = DropdownMenuPopup
const DropdownMenuLabel = DropdownMenuGroupLabel

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuPopup,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuGroupLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
