import { PropsWithChildren, ReactNode } from 'react'
import { AppSidebar } from './app-sidebar'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { ErrorBoundary } from '@/components/error-boundary'
import { useAudioPlayer } from '@/contexts/audio_player_context'

interface AppLayoutProps extends PropsWithChildren {
  title?: string
  headerPrefix?: ReactNode
  actions?: ReactNode
}

export function AppLayout({ children, title, headerPrefix, actions }: AppLayoutProps) {
  const { currentTrack } = useAudioPlayer()
  const hasPlayer = !!currentTrack

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="bg-background flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          {headerPrefix}
          {title && <h1 className="min-w-0 truncate text-lg font-semibold">{title}</h1>}
          {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
        <main
          className={`flex-1 overflow-y-auto overflow-x-hidden p-4 min-w-0 ${hasPlayer ? 'pb-24' : ''}`}
        >
          <ErrorBoundary>
            <div className="min-w-0 overflow-hidden">{children}</div>
          </ErrorBoundary>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
