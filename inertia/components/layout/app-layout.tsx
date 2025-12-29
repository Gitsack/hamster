import { PropsWithChildren, ReactNode } from 'react'
import { AppSidebar } from './app-sidebar'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { useAudioPlayer } from '@/contexts/audio_player_context'

interface AppLayoutProps extends PropsWithChildren {
  title?: string
  actions?: ReactNode
}

export function AppLayout({ children, title, actions }: AppLayoutProps) {
  const { currentTrack } = useAudioPlayer()
  const hasPlayer = !!currentTrack

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          {title && <h1 className="text-lg font-semibold">{title}</h1>}
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </header>
        <main className={`flex-1 overflow-auto p-4 ${hasPlayer ? 'pb-24' : ''}`}>
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
