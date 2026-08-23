import { Component, ErrorInfo, PropsWithChildren, ReactNode } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Alert02Icon, RefreshIcon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps extends PropsWithChildren {
  /** Custom fallback UI to show when an error is caught */
  fallback?: ReactNode
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  /** If true, renders a full-page layout. Otherwise fits within a parent container. */
  fullPage?: boolean
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const { fullPage } = this.props

      return (
        <div
          className={`flex flex-col items-center justify-center gap-4 text-center ${fullPage ? 'min-h-screen p-8' : 'py-16 px-4'}`}
          role="alert"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-muted">
            <HugeiconsIcon
              icon={Alert02Icon}
              aria-hidden="true"
              className="size-6 text-destructive"
            />
          </span>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              This part of the page stopped rendering, so nothing here is being saved or lost. Try
              again to re-render it, or reload if it keeps failing.
            </p>
            {this.state.error?.message ? (
              <p className="readout text-xs text-muted-foreground max-w-md break-words">
                {this.state.error.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={this.handleReset}>
              Try again
            </Button>
            <Button onClick={this.handleReload}>
              <HugeiconsIcon icon={RefreshIcon} aria-hidden="true" className="size-4" />
              Reload page
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
