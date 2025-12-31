import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon, ArrowUp01Icon } from '@hugeicons/core-free-icons'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

interface Season {
  seasonNumber: number
  title: string
  episodeCount: number
  airDate: string | null
  posterUrl: string | null
}

interface Episode {
  episodeNumber: number
  title: string
  overview: string | null
  airDate: string | null
  runtime: number | null
  stillUrl: string | null
}

// Selection can be either:
// - selectedSeasons: number[] (all episodes in these seasons)
// - selectedEpisodes: Record<number, number[]> (specific episodes per season)
export interface SeasonEpisodeSelection {
  selectedSeasons?: number[]
  selectedEpisodes?: Record<string, number[]>
}

interface SeasonPickerDialogProps {
  tmdbId: string
  showTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (selection: SeasonEpisodeSelection) => void
}

export function SeasonPickerDialog({
  tmdbId,
  showTitle,
  open,
  onOpenChange,
  onConfirm,
}: SeasonPickerDialogProps) {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [episodesBySeasons, setEpisodesBySeasons] = useState<Record<number, Episode[]>>({})
  const [loadingEpisodes, setLoadingEpisodes] = useState<Set<number>>(new Set())
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null)

  // Selection state - track which episodes are selected per season
  // Key: seasonNumber, Value: Set of episode numbers (empty set means no episodes selected)
  const [selectedEpisodes, setSelectedEpisodes] = useState<Record<number, Set<number>>>({})

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && tmdbId) {
      setLoading(true)
      setError(null)
      setExpandedSeason(null)
      setEpisodesBySeasons({})
      fetch(`/api/v1/tvshows/preview-seasons?tmdbId=${tmdbId}`)
        .then((r) => {
          if (!r.ok) throw new Error('Failed to load seasons')
          return r.json()
        })
        .then((data: Season[]) => {
          setSeasons(data)
          // Select all episodes in all seasons by default
          const defaultSelection: Record<number, Set<number>> = {}
          data.forEach((s) => {
            // Will be populated when episodes are loaded, for now mark season as "all selected"
            defaultSelection[s.seasonNumber] = new Set([-1]) // -1 means "all episodes"
          })
          setSelectedEpisodes(defaultSelection)
        })
        .catch((err) => {
          setError(err.message || 'Failed to load seasons')
        })
        .finally(() => setLoading(false))
    }
  }, [open, tmdbId])

  const fetchEpisodes = async (seasonNumber: number) => {
    if (episodesBySeasons[seasonNumber] || loadingEpisodes.has(seasonNumber)) return

    setLoadingEpisodes((prev) => new Set(prev).add(seasonNumber))
    try {
      const response = await fetch(
        `/api/v1/tvshows/preview-episodes?tmdbId=${tmdbId}&seasonNumber=${seasonNumber}`
      )
      if (response.ok) {
        const episodes: Episode[] = await response.json()
        setEpisodesBySeasons((prev) => ({ ...prev, [seasonNumber]: episodes }))

        // If season was marked as "all selected" (-1), convert to actual episode numbers
        if (selectedEpisodes[seasonNumber]?.has(-1)) {
          setSelectedEpisodes((prev) => ({
            ...prev,
            [seasonNumber]: new Set(episodes.map((e) => e.episodeNumber)),
          }))
        }
      }
    } catch (error) {
      console.error('Failed to fetch episodes:', error)
    } finally {
      setLoadingEpisodes((prev) => {
        const next = new Set(prev)
        next.delete(seasonNumber)
        return next
      })
    }
  }

  const toggleSeasonExpanded = (seasonNumber: number) => {
    if (expandedSeason === seasonNumber) {
      setExpandedSeason(null)
    } else {
      setExpandedSeason(seasonNumber)
      fetchEpisodes(seasonNumber)
    }
  }

  const isSeasonFullySelected = (seasonNumber: number): boolean => {
    const selected = selectedEpisodes[seasonNumber]
    if (!selected) return false
    if (selected.has(-1)) return true // "all" marker
    const episodes = episodesBySeasons[seasonNumber]
    if (!episodes) return selected.has(-1)
    return episodes.every((e) => selected.has(e.episodeNumber))
  }

  const isSeasonPartiallySelected = (seasonNumber: number): boolean => {
    const selected = selectedEpisodes[seasonNumber]
    if (!selected || selected.size === 0) return false
    if (selected.has(-1)) return false // fully selected
    const episodes = episodesBySeasons[seasonNumber]
    if (!episodes) return false
    const selectedCount = episodes.filter((e) => selected.has(e.episodeNumber)).length
    return selectedCount > 0 && selectedCount < episodes.length
  }

  const toggleSeason = (seasonNumber: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const season = seasons.find((s) => s.seasonNumber === seasonNumber)
    if (!season) return

    setSelectedEpisodes((prev) => {
      const current = prev[seasonNumber] || new Set()
      const episodes = episodesBySeasons[seasonNumber]

      if (isSeasonFullySelected(seasonNumber)) {
        // Deselect all
        return { ...prev, [seasonNumber]: new Set() }
      } else {
        // Select all
        if (episodes) {
          return { ...prev, [seasonNumber]: new Set(episodes.map((e) => e.episodeNumber)) }
        } else {
          // Episodes not loaded yet, use -1 marker
          return { ...prev, [seasonNumber]: new Set([-1]) }
        }
      }
    })
  }

  const toggleEpisode = (seasonNumber: number, episodeNumber: number) => {
    setSelectedEpisodes((prev) => {
      const current = prev[seasonNumber] || new Set()
      const next = new Set(current)

      // Remove the "all" marker if present
      next.delete(-1)

      if (next.has(episodeNumber)) {
        next.delete(episodeNumber)
      } else {
        next.add(episodeNumber)
      }

      return { ...prev, [seasonNumber]: next }
    })
  }

  const handleSelectAll = () => {
    const newSelection: Record<number, Set<number>> = {}
    seasons.forEach((s) => {
      const episodes = episodesBySeasons[s.seasonNumber]
      if (episodes) {
        newSelection[s.seasonNumber] = new Set(episodes.map((e) => e.episodeNumber))
      } else {
        newSelection[s.seasonNumber] = new Set([-1])
      }
    })
    setSelectedEpisodes(newSelection)
  }

  const handleSelectNone = () => {
    const newSelection: Record<number, Set<number>> = {}
    seasons.forEach((s) => {
      newSelection[s.seasonNumber] = new Set()
    })
    setSelectedEpisodes(newSelection)
  }

  const handleConfirm = () => {
    // Build the selection object
    const result: SeasonEpisodeSelection = {}

    // Check if all seasons have all episodes selected (or -1 marker)
    const allSeasonsFullySelected = seasons.every((s) => isSeasonFullySelected(s.seasonNumber))

    if (allSeasonsFullySelected) {
      // Simple case: all seasons selected
      result.selectedSeasons = seasons.map((s) => s.seasonNumber)
    } else {
      // Build episode-level selection
      const episodeSelection: Record<string, number[]> = {}

      for (const season of seasons) {
        const selected = selectedEpisodes[season.seasonNumber]
        if (!selected || selected.size === 0) continue

        if (selected.has(-1)) {
          // All episodes (not yet loaded) - this season is fully selected
          const episodes = episodesBySeasons[season.seasonNumber]
          if (episodes) {
            episodeSelection[String(season.seasonNumber)] = episodes.map((e) => e.episodeNumber)
          } else {
            // Can't send -1 to backend, need to fetch episodes first or send season-level
            // For simplicity, we'll use selectedSeasons for this case
            if (!result.selectedSeasons) result.selectedSeasons = []
            result.selectedSeasons.push(season.seasonNumber)
          }
        } else {
          episodeSelection[String(season.seasonNumber)] = Array.from(selected).sort((a, b) => a - b)
        }
      }

      if (Object.keys(episodeSelection).length > 0) {
        result.selectedEpisodes = episodeSelection
      }
    }

    onConfirm(result)
  }

  // Count selected episodes
  const getSelectedCount = () => {
    let totalSelected = 0
    let totalEpisodes = 0

    for (const season of seasons) {
      totalEpisodes += season.episodeCount
      const selected = selectedEpisodes[season.seasonNumber]
      if (!selected) continue

      if (selected.has(-1)) {
        totalSelected += season.episodeCount
      } else {
        totalSelected += selected.size
      }
    }

    return { totalSelected, totalEpisodes }
  }

  const { totalSelected, totalEpisodes } = getSelectedCount()
  const selectedSeasonsCount = seasons.filter(
    (s) => selectedEpisodes[s.seasonNumber]?.size > 0
  ).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Episodes</DialogTitle>
          <DialogDescription>
            Choose which seasons and episodes of "{showTitle}" you want to request.
            Click on a season to select individual episodes.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive py-4 text-center">{error}</div>
        )}

        {!loading && !error && seasons.length > 0 && (
          <>
            <div className="flex items-center justify-between border-b pb-2 mb-2">
              <span className="text-sm text-muted-foreground">
                {totalSelected} of {totalEpisodes} episodes selected
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={totalSelected === totalEpisodes}
                >
                  All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectNone}
                  disabled={totalSelected === 0}
                >
                  None
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
              {seasons.map((season) => {
                const isExpanded = expandedSeason === season.seasonNumber
                const isFullySelected = isSeasonFullySelected(season.seasonNumber)
                const isPartiallySelected = isSeasonPartiallySelected(season.seasonNumber)
                const episodes = episodesBySeasons[season.seasonNumber]
                const isLoadingEpisodes = loadingEpisodes.has(season.seasonNumber)

                return (
                  <div key={season.seasonNumber} className="border rounded-md overflow-hidden">
                    <div
                      className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleSeasonExpanded(season.seasonNumber)}
                    >
                      <Checkbox
                        checked={isFullySelected}
                        ref={(el) => {
                          if (el && isPartiallySelected) {
                            (el as any).indeterminate = true
                          }
                        }}
                        onCheckedChange={() => {}}
                        onClick={(e) => toggleSeason(season.seasonNumber, e)}
                        className={cn(isPartiallySelected && "data-[state=unchecked]:bg-primary/50")}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{season.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {season.episodeCount} episodes
                          {season.airDate && ` • ${season.airDate.substring(0, 4)}`}
                        </div>
                      </div>
                      <HugeiconsIcon
                        icon={isExpanded ? ArrowUp01Icon : ArrowDown01Icon}
                        className="h-4 w-4 text-muted-foreground"
                      />
                    </div>

                    {isExpanded && (
                      <div className="border-t bg-muted/30 p-2 space-y-1 max-h-48 overflow-y-auto">
                        {isLoadingEpisodes ? (
                          <div className="space-y-2 p-2">
                            {[1, 2, 3].map((i) => (
                              <Skeleton key={i} className="h-6 w-full" />
                            ))}
                          </div>
                        ) : episodes ? (
                          episodes.map((episode) => {
                            const isSelected = selectedEpisodes[season.seasonNumber]?.has(episode.episodeNumber)
                            return (
                              <div
                                key={episode.episodeNumber}
                                className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                                onClick={() => toggleEpisode(season.seasonNumber, episode.episodeNumber)}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleEpisode(season.seasonNumber, episode.episodeNumber)}
                                />
                                <span className="font-mono text-xs text-muted-foreground w-6">
                                  {episode.episodeNumber}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm truncate block">{episode.title}</span>
                                </div>
                                {episode.airDate && (
                                  <span className="text-xs text-muted-foreground">
                                    {episode.airDate.substring(0, 4)}
                                  </span>
                                )}
                              </div>
                            )
                          })
                        ) : null}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {!loading && !error && seasons.length === 0 && (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No seasons found
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={loading || totalSelected === 0}>
            {loading ? (
              <>
                <Spinner className="mr-2" />
                Loading...
              </>
            ) : (
              `Request ${totalSelected} Episode${totalSelected !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
