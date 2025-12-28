"use client"

import * as React from "react"
import { Progress as BaseProgress } from "@base-ui/react/progress"
import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof BaseProgress.Root>) {
  return (
    <BaseProgress.Root
      data-slot="progress"
      value={value}
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className
      )}
      {...props}
    >
      <BaseProgress.Track data-slot="progress-track" className="h-full w-full">
        <BaseProgress.Indicator
          data-slot="progress-indicator"
          className="bg-primary h-full transition-all"
        />
      </BaseProgress.Track>
    </BaseProgress.Root>
  )
}

export { Progress }
