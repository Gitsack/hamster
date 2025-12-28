"use client"

import * as React from "react"
import { Select as BaseSelect } from "@base-ui/react/select"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const Select = BaseSelect.Root

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof BaseSelect.Trigger> & {
  size?: "sm" | "default"
}) {
  return (
    <BaseSelect.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <BaseSelect.Icon>
        <ChevronDownIcon className="size-4 opacity-50" />
      </BaseSelect.Icon>
    </BaseSelect.Trigger>
  )
}

function SelectValue({
  className,
  ...props
}: React.ComponentProps<typeof BaseSelect.Value>) {
  return (
    <BaseSelect.Value
      data-slot="select-value"
      className={cn("line-clamp-1 flex items-center gap-2", className)}
      {...props}
    />
  )
}

function SelectPortal({
  ...props
}: React.ComponentProps<typeof BaseSelect.Portal>) {
  return <BaseSelect.Portal data-slot="select-portal" {...props} />
}

function SelectPositioner({
  className,
  ...props
}: React.ComponentProps<typeof BaseSelect.Positioner>) {
  return (
    <BaseSelect.Positioner
      data-slot="select-positioner"
      className={cn("outline-none", className)}
      {...props}
    />
  )
}

function SelectPopup({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseSelect.Popup>) {
  return (
    <SelectPortal>
      <SelectPositioner>
        <BaseSelect.Popup
          data-slot="select-popup"
          className={cn(
            "bg-popover text-popover-foreground relative z-50 max-h-[min(var(--available-height),20rem)] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border p-1 shadow-md",
            className
          )}
          {...props}
        >
          <SelectScrollUpButton />
          {children}
          <SelectScrollDownButton />
        </BaseSelect.Popup>
      </SelectPositioner>
    </SelectPortal>
  )
}

function SelectGroup({
  className,
  ...props
}: React.ComponentProps<typeof BaseSelect.Group>) {
  return (
    <BaseSelect.Group
      data-slot="select-group"
      className={cn("", className)}
      {...props}
    />
  )
}

function SelectGroupLabel({
  className,
  ...props
}: React.ComponentProps<typeof BaseSelect.GroupLabel>) {
  return (
    <BaseSelect.GroupLabel
      data-slot="select-group-label"
      className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseSelect.Item>) {
  return (
    <BaseSelect.Item
      data-slot="select-item"
      className={cn(
        "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <BaseSelect.ItemIndicator
        data-slot="select-item-indicator"
        className="absolute right-2 flex size-3.5 items-center justify-center"
      >
        <CheckIcon className="size-4" />
      </BaseSelect.ItemIndicator>
      <BaseSelect.ItemText>{children}</BaseSelect.ItemText>
    </BaseSelect.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-separator"
      role="separator"
      className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof BaseSelect.ScrollUpArrow>) {
  return (
    <BaseSelect.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </BaseSelect.ScrollUpArrow>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof BaseSelect.ScrollDownArrow>) {
  return (
    <BaseSelect.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </BaseSelect.ScrollDownArrow>
  )
}

export {
  Select,
  SelectPopup,
  SelectGroup,
  SelectItem,
  SelectGroupLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
