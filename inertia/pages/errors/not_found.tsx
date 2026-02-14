import { Head, Link } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <AppLayout title="Not Found">
      <Head title="Page Not Found" />
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-7xl font-bold text-muted-foreground/30 mb-4">404</div>
        <h2 className="text-xl font-semibold mb-2">Page not found</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          The page you are looking for does not exist or has been moved.
        </p>
        <Button asChild>
          <Link href="/">Go Home</Link>
        </Button>
      </div>
    </AppLayout>
  )
}
