"use client"

import * as React from "react"
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip"
import { cn } from "@/lib/utils"

function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

const Tooltip = BaseTooltip.Root

function TooltipTrigger({
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof BaseTooltip.Trigger> & {
  asChild?: boolean
}) {
  if (asChild && React.isValidElement(children)) {
    return (
      <BaseTooltip.Trigger
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
    <BaseTooltip.Trigger data-slot="tooltip-trigger" {...props}>
      {children}
    </BaseTooltip.Trigger>
  )
}

function TooltipPositioner({
  className,
  ...props
}: React.ComponentProps<typeof BaseTooltip.Positioner>) {
  return (
    <BaseTooltip.Positioner
      data-slot="tooltip-positioner"
      className={cn("outline-none", className)}
      {...props}
    />
  )
}

function TooltipContent({
  className,
  sideOffset = 4,
  children,
  ...props
}: React.ComponentProps<typeof BaseTooltip.Popup> & {
  sideOffset?: number
}) {
  return (
    <BaseTooltip.Portal>
      <TooltipPositioner sideOffset={sideOffset}>
        <BaseTooltip.Popup
          data-slot="tooltip-content"
          className={cn(
            "bg-foreground text-background z-50 w-fit rounded-md px-3 py-1.5 text-xs text-balance",
            className
          )}
          {...props}
        >
          {children}
          <BaseTooltip.Arrow className="fill-foreground z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]" />
        </BaseTooltip.Popup>
      </TooltipPositioner>
    </BaseTooltip.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
