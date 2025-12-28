import { Head } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'

export default function Calendar() {
  return (
    <AppLayout title="Calendar">
      <Head title="Calendar" />
      <div className="text-muted-foreground">
        Upcoming releases will appear here.
      </div>
    </AppLayout>
  )
}
