import { Head, router, usePage } from '@inertiajs/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppLayout } from '@/components/layout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'
import { QueueTab } from '@/components/activity/queue-tab'
import { ImportsTab } from '@/components/activity/imports-tab'
import { HistoryTab } from '@/components/activity/history-tab'
import { Num } from '@/components/activity/activity-row'
import { useProcessDownloads } from '@/components/activity/use_process_downloads'
import {
  ACTIVITY_TABS,
  ACTIVITY_TAB_PATHS,
  isActivityTab,
  parseEventFilter,
  plural,
  type ActivityTab,
  type HistoryEventFilter,
} from '@/components/activity/activity_format'
import { attentionCount, useActiveDownloads } from '@/hooks/use_active_downloads'
import { cn } from '@/lib/utils'

const TAB_LABELS: Record<ActivityTab, string> = {
  queue: 'Queue',
  imports: 'Imports',
  history: 'History',
}

interface ActivityPageProps {
  tab?: string
  user?: { isAdmin?: boolean }
  [key: string]: unknown
}

function queryOf(url: string): string {
  const index = url.indexOf('?')
  return index === -1 ? '' : url.slice(index + 1)
}

function queryValue(query: string | undefined, key: string): string | null {
  return query ? new URLSearchParams(query).get(key) : null
}

/**
 * Activity: Queue, Imports and History in one mounted page. Each tab has its own
 * URL (/activity, /activity/imports, /activity/history) so links and reloads
 * land on it; switching tabs swaps the URL client-side without a request, and a
 * tab visited once stays mounted so coming back never refetches from scratch.
 */
export default function ActivityPage() {
  const page = usePage<ActivityPageProps>()
  const query = queryOf(page.url)
  const tabProp: ActivityTab = isActivityTab(page.props.tab) ? page.props.tab : 'queue'
  const isAdmin = Boolean(page.props.user?.isAdmin)

  const [tab, setTab] = useState<ActivityTab>(tabProp)
  const [visited, setVisited] = useState<ReadonlySet<ActivityTab>>(() => new Set([tabProp]))

  // Back/forward (or a link to another tab) changes the prop; follow it.
  useEffect(() => {
    setTab(tabProp)
  }, [tabProp])

  useEffect(() => {
    setVisited((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)))
  }, [tab])

  // Each tab remembers its own query (?event=, ?client=) for when the operator comes back.
  const [savedQueries, setSavedQueries] = useState<Partial<Record<ActivityTab, string>>>(() => ({
    [tabProp]: query,
  }))
  useEffect(() => {
    setSavedQueries((prev) => (prev[tabProp] === query ? prev : { ...prev, [tabProp]: query }))
  }, [tabProp, query])
  const queryFor = (value: ActivityTab) => (value === tabProp ? query : savedQueries[value])

  const visit = useCallback((next: ActivityTab, search: string) => {
    const url = search ? `${ACTIVITY_TAB_PATHS[next]}?${search}` : ACTIVITY_TAB_PATHS[next]
    router.replace({
      url,
      props: (props) => ({ ...props, tab: next }),
      preserveState: true,
      preserveScroll: true,
    })
  }, [])

  const selectTab = (next: ActivityTab) => {
    if (next === tab) return
    setTab(next)
    visit(next, savedQueries[next] ?? '')
  }

  const setTabParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(queryFor(tab) ?? '')
    if (value === null) next.delete(key)
    else next.set(key, value)
    visit(tab, next.toString())
  }

  // A Process downloads run changes the queue, the folder and the log at once.
  const { refreshCounts, counts } = useActiveDownloads()
  const [reloadSignal, setReloadSignal] = useState(0)
  const onFilesChanged = useCallback(() => {
    setReloadSignal((n) => n + 1)
    void refreshCounts()
  }, [refreshCounts])
  const processDownloads = useProcessDownloads(onFilesChanged)

  // Keep the active tab in view when the list scrolls sideways at 375px.
  const tabsListRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const active = tabsListRef.current?.querySelector<HTMLElement>('[data-active]')
    active?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [tab])

  const attention = attentionCount(counts)
  const queueBadge = counts ? counts.active + attention : 0
  const importsBadge = counts?.unmatchedPending ?? 0

  return (
    <AppLayout title="Activity">
      <Head title={tab === 'queue' ? 'Activity' : `${TAB_LABELS[tab]} · Activity`} />

      <Tabs value={tab} onValueChange={(value) => isActivityTab(value) && selectTab(value)}>
        <div
          ref={tabsListRef}
          className="overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <TabsList className="h-10 gap-4 rounded-none bg-transparent p-0">
            {ACTIVITY_TABS.map((value) => (
              <TabsTrigger
                key={value}
                value={value}
                className="relative h-10 flex-none rounded-none border-0 px-0.5 text-muted-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent hover:text-foreground data-[active]:bg-transparent data-[active]:text-foreground data-[active]:after:bg-primary"
              >
                {TAB_LABELS[value]}
                {value === 'queue' && queueBadge > 0 && (
                  <TabCount
                    count={queueBadge}
                    alarm={attention > 0}
                    label={
                      attention > 0
                        ? `${plural(attention, 'item')} need attention`
                        : `${counts?.active ?? 0} downloading`
                    }
                  />
                )}
                {value === 'imports' && importsBadge > 0 && (
                  <TabCount
                    count={importsBadge}
                    label={`${plural(importsBadge, 'unmatched file')} pending`}
                  />
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {processDownloads.processing && <ProcessingLog messages={processDownloads.messages} />}

        {ACTIVITY_TABS.map((value) => (
          <TabsContent key={value} value={value} keepMounted className="pt-4">
            {visited.has(value) && value === 'queue' && (
              <QueueTab
                reloadSignal={reloadSignal}
                processing={processDownloads.processing}
                onProcessDownloads={processDownloads.run}
                isAdmin={isAdmin}
              />
            )}
            {visited.has(value) && value === 'imports' && (
              <ImportsTab
                clientParam={queryValue(queryFor('imports'), 'client')}
                onClientChange={(id) => setTabParam('client', id)}
                isAdmin={isAdmin}
                reloadSignal={reloadSignal}
                processing={processDownloads.processing}
                onProcessDownloads={processDownloads.run}
              />
            )}
            {visited.has(value) && value === 'history' && (
              <HistoryTab
                eventFilter={parseEventFilter(queryValue(queryFor('history'), 'event'))}
                onEventFilterChange={(filter: HistoryEventFilter) =>
                  setTabParam('event', filter === 'all' ? null : filter)
                }
                reloadSignal={reloadSignal}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </AppLayout>
  )
}

function TabCount({
  count,
  label,
  alarm = false,
}: {
  count: number
  label: string
  alarm?: boolean
}) {
  return (
    <span
      className={cn(
        'ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium',
        alarm ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
      )}
    >
      <Num>{count}</Num>
      <span className="sr-only">, {label}</span>
    </span>
  )
}

/** The live Process downloads log. Transit Magenta: files are being moved. */
function ProcessingLog({ messages }: { messages: string[] }) {
  const recent = messages.slice(-8)
  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-4 rounded-xl border border-status-transit/30 bg-status-transit/5 px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <Spinner className="size-4 text-status-transit-ink" />
        <span className="text-sm font-medium">Scanning completed downloads…</span>
        <span className="ml-auto text-xs text-muted-foreground">
          <Num>{messages.length}</Num> {messages.length === 1 ? 'step' : 'steps'}
        </span>
      </div>
      {recent.length > 0 && (
        <div className="mt-2 max-h-32 space-y-0.5 overflow-y-auto pl-7">
          {recent.map((message, index) => (
            <p
              key={messages.length - recent.length + index}
              className={cn(
                'readout text-xs break-words',
                index === recent.length - 1 ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {message}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
