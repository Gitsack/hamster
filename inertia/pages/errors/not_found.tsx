import { Head, Link } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import { SearchRemoveIcon } from '@hugeicons/core-free-icons'

export default function NotFound() {
  return (
    <AppLayout title="Not Found">
      <Head title="Page Not Found" />
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <HugeiconsIcon
            icon={SearchRemoveIcon}
            aria-hidden="true"
            className="size-6 text-muted-foreground"
          />
        </div>
        <h2 className="mt-4 text-lg font-medium">Nothing is served at this address</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          The server answered <span className="readout">404</span> for this URL. The link is either
          stale or points at a page an older version of Hamster used to serve. Pick the section you
          wanted from the sidebar, or go back to the start.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </AppLayout>
  )
}
