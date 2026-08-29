export interface CastMember {
  id: number
  name: string
  character: string
  profileUrl?: string
}

/** Never more than this, however many the provider returns. */
const MAX_CAST = 8

/**
 * Billed cast, as a grid rather than a horizontal scroller.
 *
 * The scroller it replaces was unbounded and, on a phone, sat inside a sheet that itself
 * scrolls — an over-swipe handed the gesture to the browser's back-navigation and threw
 * the operator off the page. A grid has no competing gesture, wraps at every width, and
 * gets the name and role onto one line each instead of stacking two clamped blocks under
 * a square tile.
 */
export function CastLane({ cast, className }: { cast?: CastMember[]; className?: string }) {
  if (!cast || cast.length === 0) return null

  return (
    <div className={className}>
      <h3 className="mb-3 text-base font-semibold">Cast</h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {cast.slice(0, MAX_CAST).map((actor) => (
          <div key={actor.id} className="flex min-w-0 items-center gap-2.5">
            <div className="bg-muted size-10 shrink-0 overflow-hidden rounded-full">
              {actor.profileUrl ? (
                <img
                  src={actor.profileUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="text-muted-foreground flex h-full w-full items-center justify-center text-sm font-semibold">
                  {actor.name.charAt(0)}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{actor.name}</p>
              <p className="text-muted-foreground truncate text-xs">{actor.character}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
