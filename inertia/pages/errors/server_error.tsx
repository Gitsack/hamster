import { Head, Link } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import { Alert01Icon } from '@hugeicons/core-free-icons'

export default function ServerError(props: { error: { message?: string } }) {
  const message = props.error?.message

  return (
    <AppLayout title="Server Error">
      <Head title="Server Error" />
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <HugeiconsIcon
            icon={Alert01Icon}
            aria-hidden="true"
            className="size-6 text-destructive"
          />
        </div>
        <h2 className="mt-4 text-lg font-medium">The server could not finish that request</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Hamster answered <span className="readout">500</span> while handling this request, so the
          action did not complete. Retry it; if it keeps failing, the stack trace is in the server
          log.
        </p>
        {message && (
          <p className="readout mt-4 max-w-md overflow-x-auto rounded-md border border-border bg-muted px-3 py-2 text-left text-xs text-foreground">
            {message}
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/system/status">Check system status</Link>
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
