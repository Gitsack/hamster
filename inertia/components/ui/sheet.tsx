'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SheetContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SheetContext = React.createContext<SheetContextValue | null>(null)

function useSheet() {
  const context = React.useContext(SheetContext)
  if (!context) {
    throw new Error('Sheet components must be used within a Sheet')
  }
  return context
}

/** Lets SheetContent name itself from whatever SheetTitle the caller renders. */
const SheetTitleIdContext = React.createContext<string | undefined>(undefined)

interface SheetProps {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
}

function Sheet({ children, open: controlledOpen, onOpenChange, defaultOpen = false }: SheetProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(newOpen)
      }
      onOpenChange?.(newOpen)
    },
    [isControlled, onOpenChange]
  )

  return (
    <SheetContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      {children}
    </SheetContext.Provider>
  )
}

interface SheetTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

function SheetTrigger({ asChild, children, onClick, ...props }: SheetTriggerProps) {
  const { onOpenChange } = useSheet()

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e)
    onOpenChange(true)
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        ;(children as React.ReactElement<any>).props.onClick?.(e)
        onOpenChange(true)
      },
    })
  }

  return (
    <button type="button" onClick={handleClick} {...props}>
      {children}
    </button>
  )
}

function SheetClose({
  children,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { onOpenChange } = useSheet()

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e)
    onOpenChange(false)
  }

  return (
    <button type="button" onClick={handleClick} {...props}>
      {children}
    </button>
  )
}

interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: 'top' | 'right' | 'bottom' | 'left'
}

function SheetContent({ className, children, side = 'right', ...props }: SheetContentProps) {
  const { open, onOpenChange } = useSheet()
  const [mounted, setMounted] = React.useState(false)
  const [isVisible, setIsVisible] = React.useState(false)
  const [isAnimating, setIsAnimating] = React.useState(false)
  const titleId = React.useId()
  const panelRef = React.useRef<HTMLDivElement>(null)
  const closeRef = React.useRef<HTMLButtonElement>(null)
  const returnFocusRef = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Handle animation states
  React.useEffect(() => {
    if (open) {
      setIsVisible(true)
      // Small delay to ensure the element is rendered before animating
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true)
        })
      })
    } else {
      setIsAnimating(false)
      // Wait for animation to complete before hiding
      const timer = setTimeout(() => {
        setIsVisible(false)
      }, 300) // Match animation duration
      return () => clearTimeout(timer)
    }
  }, [open])

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  // Move focus in on open and hand it back to whatever opened the sheet on close,
  // so a keyboard operator is never dropped into the obscured page behind.
  React.useEffect(() => {
    if (!open) return
    returnFocusRef.current = document.activeElement as HTMLElement | null
    const frame = requestAnimationFrame(() => closeRef.current?.focus())
    return () => {
      cancelAnimationFrame(frame)
      returnFocusRef.current?.focus?.()
    }
  }, [open])

  // Escape closes, and Tab is kept inside the panel.
  React.useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Only the topmost layer responds, so a dialog opened from inside the
        // sheet closes itself without taking the sheet with it.
        if (document.querySelector('[data-slot="dialog-content"]')) return
        onOpenChange(false)
        return
      }
      if (e.key !== 'Tab') return

      const panel = panelRef.current
      if (!panel) return
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  if (!mounted || !isVisible) return null

  const slideClasses = {
    right: {
      initial: 'translate-x-full',
      animate: 'translate-x-0',
    },
    left: {
      initial: '-translate-x-full',
      animate: 'translate-x-0',
    },
    top: {
      initial: '-translate-y-full',
      animate: 'translate-y-0',
    },
    bottom: {
      initial: 'translate-y-full',
      animate: 'translate-y-0',
    },
  }

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-black/50 transition-opacity duration-300 ease-out',
          isAnimating ? 'opacity-100' : 'opacity-0'
        )}
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      {/* Content */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-slot="sheet-content"
        className={cn(
          'bg-popover text-popover-foreground border-border absolute flex flex-col shadow-lg outline-none transition-transform duration-300 ease-out',
          // Never full-bleed: a 3rem strip of backdrop stays tappable, which on touch is
          // the only dismiss affordance there is.
          side === 'right' && 'inset-y-0 right-0 h-full w-[calc(100%-3rem)] border-l sm:max-w-md',
          side === 'left' && 'inset-y-0 left-0 h-full w-[calc(100%-3rem)] border-r sm:max-w-md',
          side === 'top' && 'inset-x-0 top-0 h-auto border-b',
          side === 'bottom' && 'inset-x-0 bottom-0 h-auto border-t',
          isAnimating ? slideClasses[side].animate : slideClasses[side].initial,
          className
        )}
        {...props}
      >
        {/* First child, so it is the first tab stop; pinned to the panel rather than to a
            scrolling child, so it cannot ride off the top. */}
        <button
          ref={closeRef}
          type="button"
          onClick={() => onOpenChange(false)}
          className="focus-visible:ring-ring/50 focus-visible:border-ring text-muted-foreground hover:bg-accent hover:text-accent-foreground absolute top-4 right-4 z-20 flex size-8 items-center justify-center rounded-md border border-transparent transition-colors outline-none focus-visible:ring-[3px] disabled:pointer-events-none"
        >
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </button>
        <SheetTitleIdContext.Provider value={titleId}>{children}</SheetTitleIdContext.Provider>
      </div>
    </div>,
    document.body
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex flex-col gap-1.5 p-6 pb-0', className)}
      {...props}
    />
  )
}

/** The sheet's only scrolling region. Contained, so an over-scroll never reaches the page. */
function SheetBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-body"
      className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain', className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        'border-border bg-popover mt-auto flex shrink-0 flex-col gap-2 border-t p-4',
        className
      )}
      {...props}
    />
  )
}

function SheetTitle({ className, id, ...props }: React.ComponentProps<'h2'>) {
  const titleId = React.useContext(SheetTitleIdContext)
  return (
    <h2
      data-slot="sheet-title"
      id={id ?? titleId}
      className={cn('text-foreground text-lg font-semibold', className)}
      {...props}
    />
  )
}

function SheetDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="sheet-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
