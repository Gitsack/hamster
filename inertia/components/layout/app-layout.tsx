import { PropsWithChildren, ReactNode, useRef } from 'react'
import { AppSidebar } from './app-sidebar'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { ErrorBoundary } from '@/components/error-boundary'
import { useAudioPlayer } from '@/contexts/audio_player_context'
import { useHideOnScroll } from '@/hooks/use_hide_on_scroll'

interface AppLayoutProps extends PropsWithChildren {
  title?: string
  headerPrefix?: ReactNode
  actions?: ReactNode
}

export function AppLayout({ children, title, headerPrefix, actions }: AppLayoutProps) {
  const { currentTrack } = useAudioPlayer()
  const hasPlayer = !!currentTrack
  const scrollRef = useRef<HTMLDivElement>(null)
  const headerHidden = useHideOnScroll(scrollRef)

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* The header scrolls with the page so it can slide away, and sticks to the top so
            scrolling up brings the breadcrumbs, title and page actions straight back. Below
            md that reclaims a fifth of the viewport; from md up it simply stays put. */}
        <div ref={scrollRef} className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
          <header
            className={`bg-background sticky top-0 z-20 flex min-h-14 flex-wrap items-center gap-2 border-b border-border px-4 py-2 transition-transform duration-200 ease-out motion-reduce:transition-none md:translate-y-0 ${
              headerHidden ? '-translate-y-full' : 'translate-y-0'
            }`}
          >
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            {headerPrefix}
            {title && <h1 className="min-w-0 truncate text-lg font-semibold">{title}</h1>}
            {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
          </header>
          <div className={`p-4 min-w-0 ${hasPlayer ? 'pb-24' : ''}`}>
            <ErrorBoundary>
              <div className="min-w-0 overflow-hidden">{children}</div>
            </ErrorBoundary>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
