import { HugeiconsIcon } from '@hugeicons/react'
import { Film01Icon, Tv01Icon } from '@hugeicons/core-free-icons'
import { Badge } from '@/components/ui/badge'
import { CardStatusBadge, type MediaItemStatus } from '@/components/library/media-status-badge'
import { useState, useCallback, useEffect, useRef } from 'react'

export interface StreamingProviderInfo {
  id: number
  name: string
  logoUrl: string
}

interface MediaTeaserProps {
  tmdbId: string
  title: string
  year?: number
  posterUrl?: string | null
  genres?: string[]
  mediaType: 'movie' | 'tv'
  status: MediaItemStatus
  isToggling?: boolean
  showStatusOnHover?: boolean
  onToggleRequest?: () => void
  streamingProviders?: StreamingProviderInfo[]
  isLoadingProviders?: boolean
  onClick?: () => void
  size?: 'grid' | 'lane' | 'small'
  observerRef?: (el: HTMLDivElement | null) => void
}

export function StreamingProviderLoader({ fadeOut = false }: { fadeOut?: boolean } = {}) {
  // Two arc segments per ring — inner rotates clockwise, outer counter-clockwise
  return (
    <div
      className={`h-5 w-5 rounded-sm overflow-hidden flex items-center justify-center ${fadeOut ? 'streaming-fade-out' : 'streaming-fade-in'}`}
      style={{ backgroundColor: 'oklch(0.15 0.06 277 / 0.6)' }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        {/* Inner ring (r=4) — two 120° arcs with 60° gaps, rotates clockwise */}
        <g className="streaming-spin-cw" style={{ transformOrigin: '12px 12px' }}>
          <path
            d="M 16 12 A 4 4 0 0 1 10 15.46"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M 8 12 A 4 4 0 0 1 14 8.54"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </g>
        {/* Outer ring (r=8) — two 120° arcs with 60° gaps, rotates counter-clockwise */}
        <g className="streaming-spin-ccw" style={{ transformOrigin: '12px 12px' }}>
          <path
            d="M 20 12 A 8 8 0 0 1 8 18.93"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.7"
          />
          <path
            d="M 4 12 A 8 8 0 0 1 16 5.07"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.7"
          />
        </g>
      </svg>
    </div>
  )
}

export function MediaTeaser({
  tmdbId,
  title,
  year,
  posterUrl,
  genres,
  mediaType,
  status,
  isToggling = false,
  showStatusOnHover = false,
  onToggleRequest,
  streamingProviders,
  isLoadingProviders = false,
  onClick,
  size = 'grid',
  observerRef,
}: MediaTeaserProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const hasImage = posterUrl && !imageFailed

  const handleImageError = useCallback(() => {
    setImageFailed(true)
  }, [])

  // Track loading→loaded transition: 'loading' | 'fading-out' | 'fading-in' | 'idle'
  const wasLoadingRef = useRef(false)
  const [transition, setTransition] = useState<'loading' | 'fading-out' | 'fading-in' | 'idle'>('idle')

  useEffect(() => {
    if (isLoadingProviders) {
      wasLoadingRef.current = true
      setTransition('loading')
    } else if (wasLoadingRef.current) {
      wasLoadingRef.current = false
      setTransition('fading-out')
      const t1 = setTimeout(() => {
        setTransition(streamingProviders && streamingProviders.length > 0 ? 'fading-in' : 'idle')
      }, 250)
      const t2 = setTimeout(() => {
        setTransition('idle')
      }, 500)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
  }, [isLoadingProviders, streamingProviders])

  const IconComponent = mediaType === 'movie' ? Film01Icon : Tv01Icon

  const widthClass =
    size === 'lane' ? 'w-[150px]' : size === 'small' ? 'w-32' : ''
  const iconSize =
    size === 'small' ? 'h-8 w-8' : 'h-12 w-12'
  const titleSize =
    size === 'small' ? 'text-xs' : 'text-sm'
  const yearSize =
    size === 'small' ? 'text-[10px]' : 'text-xs'

  const maxProviders = 3
  const visibleProviders = streamingProviders?.slice(0, maxProviders) ?? []
  const extraCount = (streamingProviders?.length ?? 0) - maxProviders

  return (
    <div
      ref={observerRef}
      className={`group cursor-pointer ${size === 'lane' || size === 'small' ? `flex-shrink-0 ${widthClass}` : ''}`}
      onClick={onClick}
    >
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted">
        {hasImage ? (
          <img
            src={posterUrl!}
            alt={title}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
            onError={handleImageError}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <HugeiconsIcon
              icon={IconComponent}
              className={`${iconSize} text-muted-foreground/30`}
            />
          </div>
        )}
        {/* Genre badge */}
        {genres && genres.length > 0 && (
          <Badge
            className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 bg-black/40 backdrop-blur-sm text-white/90 border-0"
            variant="secondary"
          >
            {genres[0].toUpperCase()}
          </Badge>
        )}
        {/* Hover gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        {/* Status badge */}
        <div
          className="absolute top-2 right-2 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <CardStatusBadge
            status={status}
            size="tiny"
            showOnHover={showStatusOnHover}
            isToggling={isToggling}
            onToggleRequest={onToggleRequest}
          />
        </div>
        {/* Streaming provider badges / loading */}
        {transition === 'fading-out' ? (
          <div className="absolute bottom-2 left-2 z-10">
            <StreamingProviderLoader fadeOut />
          </div>
        ) : transition === 'fading-in' && visibleProviders.length > 0 ? (
          <div className="absolute bottom-2 left-2 flex items-center -space-x-1 z-10 streaming-fade-in">
            {visibleProviders.map((provider) => (
              <img
                key={provider.id}
                src={provider.logoUrl}
                alt={provider.name}
                title={provider.name}
                className="h-5 w-5 rounded-sm ring-1 ring-black/40 shadow-sm"
              />
            ))}
            {extraCount > 0 && (
              <span className="text-[9px] font-medium text-white bg-black/50 rounded-sm px-1 py-0.5 ring-1 ring-black/40 ml-0.5">
                +{extraCount}
              </span>
            )}
          </div>
        ) : visibleProviders.length > 0 ? (
          <div className="absolute bottom-2 left-2 flex items-center -space-x-1 z-10">
            {visibleProviders.map((provider) => (
              <img
                key={provider.id}
                src={provider.logoUrl}
                alt={provider.name}
                title={provider.name}
                className="h-5 w-5 rounded-sm ring-1 ring-black/40 shadow-sm"
              />
            ))}
            {extraCount > 0 && (
              <span className="text-[9px] font-medium text-white bg-black/50 rounded-sm px-1 py-0.5 ring-1 ring-black/40 ml-0.5">
                +{extraCount}
              </span>
            )}
          </div>
        ) : transition === 'loading' ? (
          <div className="absolute bottom-2 left-2 z-10">
            <StreamingProviderLoader />
          </div>
        ) : null}
        {/* Hover info */}
        <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <p className={`text-white ${titleSize} font-medium line-clamp-2`}>{title}</p>
          {year ? <p className={`text-white/70 ${yearSize}`}>{year}</p> : null}
        </div>
      </div>
    </div>
  )
}
