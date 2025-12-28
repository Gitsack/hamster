import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Merges props onto a single React element child.
 * Used for the `asChild` pattern to pass styling/props to a child component.
 */
function Slot({
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  if (React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      ...children.props,
      className: cn(props.className, children.props.className),
    })
  }

  if (React.Children.count(children) > 1) {
    React.Children.only(null) // This will throw an error
  }

  return null
}

export { Slot }
