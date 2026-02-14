import { Head, Link } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'

export default function ServerError(props: { error: { message?: string } }) {
  return (
    <AppLayout title="Server Error">
      <Head title="Server Error" />
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-7xl font-bold text-muted-foreground/30 mb-4">500</div>
        <h2 className="text-xl font-semibold mb-2">Server Error</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          {props.error?.message || 'An unexpected error occurred. Please try again later.'}
        </p>
        <Button asChild>
          <Link href="/">Go Home</Link>
        </Button>
      </div>
    </AppLayout>
  )
}
