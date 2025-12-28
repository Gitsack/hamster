import { Head } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'

export default function UISettings() {
  return (
    <AppLayout title="Profile Settings">
      <Head title="Profile Settings" />
      <div className="text-muted-foreground">
        Profile and UI settings will appear here.
      </div>
    </AppLayout>
  )
}
