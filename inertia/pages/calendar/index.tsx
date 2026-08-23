import { Head, Link } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Film01Icon,
  Tv01Icon,
  MusicNote01Icon,
  Book01Icon,
  CheckmarkCircle01Icon,
  Link01Icon,
} from '@hugeicons/core-free-icons'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

interface CalendarEvent {
  uid: string
  title: string
  description?: string
  startDate: string
  mediaType: 'episode' | 'movie' | 'album' | 'book'
  hasFile: boolean
}

const MEDIA_LABELS: Record<string, string> = {
  episode: 'TV',
  movie: 'Movie',
  album: 'Music',
  book: 'Book',
}

const MEDIA_ICONS: Record<string, typeof Film01Icon> = {
  episode: Tv01Icon,
  movie: Film01Icon,
  album: MusicNote01Icon,
  book: Book01Icon,
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Adjust to Monday-start week (0=Mon, 6=Sun)
  let startOffset = firstDay.getDay() - 1
  if (startOffset < 0) startOffset = 6

  const days: { date: Date; isCurrentMonth: boolean }[] = []

  // Days from previous month
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i)
    days.push({ date: d, isCurrentMonth: false })
  }

  // Days of current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true })
  }

  // Fill remaining days to complete the grid (up to 42 = 6 rows)
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false })
  }

  return days
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isToday(date: Date): boolean {
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

function getDetailUrl(event: CalendarEvent): string | null {
  const idMatch = event.uid.match(/^(\w+)-(\d+)@/)
  if (!idMatch) return null
  const [, type, id] = idMatch
  switch (type) {
    case 'episode':
      return null // episodes don't have a standalone page
    case 'movie':
      return `/movie/${id}`
    case 'album':
      return `/album/${id}`
    case 'book':
      return `/book/${id}`
    default:
      return null
  }
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showUnmonitored, setShowUnmonitored] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch a range covering the full visible grid (prev month days + current + next)
      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month + 2, 0)
      const params = new URLSearchParams({
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
        unmonitored: showUnmonitored ? 'true' : 'false',
      })
      const response = await fetch(`/api/v1/calendar?${params}`)
      if (response.ok) {
        const data = await response.json()
        setEvents(data)
      } else {
        toast.error(`Calendar refused the request (HTTP ${response.status})`, {
          description: 'Move to another month or reload the page to try again.',
        })
      }
    } catch {
      toast.error('Could not reach Hamster while loading the calendar', {
        description: 'The server may be restarting. Reload the page once it is back.',
      })
    } finally {
      setLoading(false)
    }
  }, [year, month, showUnmonitored])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // Group events by date
  const eventsByDate = new Map<string, CalendarEvent[]>()
  for (const event of events) {
    const key = event.startDate.split('T')[0]
    if (!eventsByDate.has(key)) {
      eventsByDate.set(key, [])
    }
    eventsByDate.get(key)!.push(event)
  }

  const days = getMonthDays(year, month)
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long' })

  const goToPrevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const goToNextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
  const goToToday = () => {
    setCurrentDate(new Date())
    setSelectedDay(formatDateKey(new Date()))
  }

  const selectedEvents = selectedDay ? eventsByDate.get(selectedDay) || [] : []

  return (
    <AppLayout
      title="Calendar"
      actions={
        <div className="flex items-center gap-2">
          <a
            href="/api/v1/calendar.ics"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex"
          >
            <Button variant="outline" size="sm">
              <HugeiconsIcon icon={Link01Icon} className="h-4 w-4 mr-2" />
              iCal
            </Button>
          </a>
        </div>
      }
    >
      <Head title="Calendar" />

      <div className="space-y-4">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToPrevMonth}>
              <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={goToNextMonth}>
              <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold ml-2">
              {monthName} {year}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="showUnmonitored"
                checked={showUnmonitored}
                onCheckedChange={(checked) => setShowUnmonitored(!!checked)}
              />
              <Label htmlFor="showUnmonitored" className="text-sm font-normal cursor-pointer">
                Show unmonitored
              </Label>
            </div>
          </div>
        </div>

        {/* Legend — media type is carried by its icon; colour is reserved for state. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          {Object.entries(MEDIA_LABELS).map(([type, label]) => (
            <div key={type} className="flex items-center gap-1.5 text-muted-foreground">
              <HugeiconsIcon icon={MEDIA_ICONS[type]} className="h-3.5 w-3.5" />
              <span>{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <HugeiconsIcon
              icon={CheckmarkCircle01Icon}
              className="h-3.5 w-3.5 text-status-complete-ink"
            />
            <span>On disk</span>
          </div>
        </div>

        {/* Calendar Grid */}
        {loading ? (
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="bg-muted px-2 py-2 text-center text-xs font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="bg-card p-1.5 min-h-[72px] sm:min-h-[112px]">
                <Skeleton className="h-4 w-6 mb-2" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
            {/* Weekday headers */}
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="bg-muted px-2 py-2 text-center text-xs font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}

            {/* Day cells */}
            {days.map(({ date, isCurrentMonth }, index) => {
              const dateKey = formatDateKey(date)
              const dayEvents = eventsByDate.get(dateKey) || []
              const today = isToday(date)
              const isSelected = selectedDay === dateKey

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedDay(isSelected ? null : dateKey)}
                  aria-pressed={isSelected}
                  className={`relative bg-card p-1.5 min-h-[72px] sm:min-h-[112px] text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset ${
                    !isCurrentMonth ? 'opacity-40' : ''
                  } ${isSelected ? 'ring-2 ring-primary ring-inset' : ''}`}
                >
                  <div
                    className={`readout text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                      today ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {date.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.uid}
                        className={`flex items-center gap-1 rounded-sm bg-muted px-1 py-0.5 text-xs leading-4 ${
                          event.hasFile ? 'text-muted-foreground' : 'text-foreground'
                        }`}
                        title={
                          event.hasFile
                            ? `${event.title} — on disk`
                            : `${event.title} — not on disk`
                        }
                      >
                        <HugeiconsIcon
                          icon={
                            event.hasFile ? CheckmarkCircle01Icon : MEDIA_ICONS[event.mediaType]
                          }
                          className={`h-3 w-3 shrink-0 ${
                            event.hasFile ? 'text-status-complete-ink' : 'text-muted-foreground'
                          }`}
                        />
                        <span className="truncate">{event.title}</span>
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="px-1 text-xs text-muted-foreground">
                        <span className="readout">+{dayEvents.length - 3}</span> more
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Selected Day Detail */}
        {selectedDay && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-base font-semibold">
              {new Date(selectedDay + 'T00:00:00').toLocaleDateString('default', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </h3>
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing releases on this day. Pick another date, or turn on “Show unmonitored” to
                include titles you are not tracking.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {selectedEvents.map((event) => {
                  const url = getDetailUrl(event)
                  const icon = MEDIA_ICONS[event.mediaType]
                  const content = (
                    <div
                      className={`flex items-center gap-3 px-2 py-2.5 ${
                        url ? 'rounded-md transition-colors hover:bg-accent' : ''
                      }`}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <HugeiconsIcon icon={icon} className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-sm font-medium">{event.title}</div>
                        {event.description && (
                          <div className="truncate text-xs text-muted-foreground">
                            {event.description}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {MEDIA_LABELS[event.mediaType]}
                        </Badge>
                        {event.hasFile && (
                          <Badge className="gap-1 border-transparent bg-status-complete text-white">
                            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-3 w-3" />
                            On disk
                          </Badge>
                        )}
                      </div>
                    </div>
                  )

                  return url ? (
                    <Link key={event.uid} href={url}>
                      {content}
                    </Link>
                  ) : (
                    <div key={event.uid}>{content}</div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
