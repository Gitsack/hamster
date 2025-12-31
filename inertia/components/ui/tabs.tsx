"use client"

import * as React from "react"
import { Tabs as BaseTabs } from "@base-ui/react/tabs"
import { cn } from "@/lib/utils"

// Context to share stable ID with child components
const TabsIdContext = React.createContext<string | undefined>(undefined)

function Tabs({
  className,
  id,
  ...props
}: React.ComponentProps<typeof BaseTabs.Root> & { id?: string }) {
  // Generate a stable ID for SSR/hydration consistency
  const reactId = React.useId()
  const stableId = id || reactId

  return (
    <TabsIdContext.Provider value={stableId}>
      <BaseTabs.Root
        data-slot="tabs"
        className={cn("flex flex-col gap-2", className)}
        {...props}
      />
    </TabsIdContext.Provider>
  )
}

function TabsList({
  className,
  id,
  ...props
}: React.ComponentProps<typeof BaseTabs.List>) {
  const tabsId = React.useContext(TabsIdContext)
  const listId = id || (tabsId ? `${tabsId}-list` : undefined)

  return (
    <BaseTabs.List
      id={listId}
      data-slot="tabs-list"
      className={cn(
        "bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  value,
  id,
  ...props
}: React.ComponentProps<typeof BaseTabs.Tab>) {
  const tabsId = React.useContext(TabsIdContext)
  const triggerId = id || (tabsId && value ? `${tabsId}-trigger-${value}` : undefined)

  return (
    <BaseTabs.Tab
      id={triggerId}
      value={value}
      data-slot="tabs-trigger"
      className={cn(
        "data-[active]:bg-primary data-[active]:text-white focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  value,
  id,
  ...props
}: React.ComponentProps<typeof BaseTabs.Panel>) {
  const tabsId = React.useContext(TabsIdContext)
  const panelId = id || (tabsId && value ? `${tabsId}-panel-${value}` : undefined)

  return (
    <BaseTabs.Panel
      id={panelId}
      value={value}
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
