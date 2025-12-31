"use client"

import * as React from "react"
import { Accordion } from "@base-ui/react/accordion"
import { Collapsible } from "@base-ui/react/collapsible"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"

function AccordionRoot({
  className,
  ...props
}: React.ComponentProps<typeof Accordion.Root>) {
  return (
    <Accordion.Root
      data-slot="accordion"
      className={cn("flex flex-col", className)}
      {...props}
    />
  )
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof Accordion.Item>) {
  return (
    <Accordion.Item
      data-slot="accordion-item"
      className={cn("border-b border-border", className)}
      {...props}
    />
  )
}

function AccordionHeader({
  className,
  ...props
}: React.ComponentProps<typeof Accordion.Header>) {
  return (
    <Accordion.Header
      data-slot="accordion-header"
      className={cn("flex", className)}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Accordion.Trigger>) {
  return (
    <Accordion.Trigger
      data-slot="accordion-trigger"
      className={cn(
        "group flex flex-1 items-center justify-between gap-4 py-4 text-left text-sm font-medium transition-all hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&[data-panel-open]>svg]:rotate-180",
        className
      )}
      {...props}
    >
      {children}
      <HugeiconsIcon
        icon={ArrowDown01Icon}
        className="size-4 shrink-0 text-muted-foreground transition-transform duration-200"
      />
    </Accordion.Trigger>
  )
}

function AccordionPanel({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Accordion.Panel>) {
  return (
    <Accordion.Panel
      data-slot="accordion-panel"
      className={cn(
        "h-[var(--accordion-panel-height)] overflow-hidden text-sm transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0",
        className
      )}
      {...props}
    >
      <div className="pb-4 pt-0">{children}</div>
    </Accordion.Panel>
  )
}

// Collapsible components for standalone use
function CollapsibleRoot({
  className,
  ...props
}: React.ComponentProps<typeof Collapsible.Root>) {
  return (
    <Collapsible.Root
      data-slot="collapsible"
      className={cn("flex flex-col", className)}
      {...props}
    />
  )
}

function CollapsibleTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Collapsible.Trigger>) {
  return (
    <Collapsible.Trigger
      data-slot="collapsible-trigger"
      className={cn(
        "group flex items-center gap-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&[data-panel-open]>svg]:rotate-90",
        className
      )}
      {...props}
    >
      <HugeiconsIcon
        icon={ArrowDown01Icon}
        className="size-3 shrink-0 -rotate-90 text-muted-foreground transition-transform duration-200"
      />
      {children}
    </Collapsible.Trigger>
  )
}

function CollapsiblePanel({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Collapsible.Panel>) {
  return (
    <Collapsible.Panel
      data-slot="collapsible-panel"
      className={cn(
        "h-[var(--collapsible-panel-height)] overflow-hidden text-sm transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0",
        className
      )}
      {...props}
    >
      {children}
    </Collapsible.Panel>
  )
}

export {
  AccordionRoot,
  AccordionItem,
  AccordionHeader,
  AccordionTrigger,
  AccordionPanel,
  CollapsibleRoot,
  CollapsibleTrigger,
  CollapsiblePanel,
}
