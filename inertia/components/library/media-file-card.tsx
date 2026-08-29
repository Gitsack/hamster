import { type ReactNode } from 'react'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MediaSpecs, type MediaSpec } from '@/components/library/media-specs'
import { cn } from '@/lib/utils'

/**
 * Flatten the facts we hold about a file into one short, non-repeating list.
 *
 * The pieces arrive already overlapping: the quality name carries the resolution
 * ("Bluray-1080p") and so does the probed summary ("1080p · h264 · EAC3 5.1"), so
 * printing both spends a phone-width line saying 1080p twice. Split the joined
 * strings apart, then drop anything an earlier fact already contains.
 */
export function fileFacts(parts: (string | null | undefined)[]): string[] {
  const flat = parts
    .filter((part): part is string => Boolean(part))
    .flatMap((part) => part.split(/[·•]/))
    .map((part) => part.trim())
    .filter(Boolean)

  return flat.filter(
    (part, index) =>
      !flat.some(
        (earlier, earlierIndex) =>
          earlierIndex < index &&
          part.length >= 3 &&
          earlier.toLowerCase().includes(part.toLowerCase())
      )
  )
}

/**
 * The facts line for rows too dense to carry labels — an episode inside a season
 * accordion. It wraps rather than overflows, because phones exist.
 */
export function FileFacts({ facts, className }: { facts: string[]; className?: string }) {
  if (facts.length === 0) return null

  return (
    <div
      className={cn(
        'readout text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs',
        className
      )}
    >
      {facts.map((fact, index) => (
        <span key={fact} className="flex items-center gap-2">
          {index > 0 && (
            <span aria-hidden className="text-border">
              ·
            </span>
          )}
          {fact}
        </span>
      ))}
    </div>
  )
}

/**
 * The file section of a detail page: what is on disk, and what you can do to it.
 *
 * Three ranks, and only three. The card says File and carries the actions in its
 * header, because what you can do to a file does not change per file. The filename
 * is the payload and gets the Readout treatment on its own line. The measurements
 * sit under a seam in the same labelled spec band the hero uses for root folder and
 * quality profile — an operator hunting the audio codec finds it by its label
 * instead of counting dots along a run-on line.
 *
 * What it used to be: a subtitle-weight "File" shouting over a bordered box inside
 * a bordered card, holding an icon, a filename, an undifferentiated grey line, and
 * the whole absolute path the hero already answers. Box in a box, and the loudest
 * thing on it was the word File.
 */
export function MediaFileCard({
  path,
  specs,
  actions,
  children,
}: {
  path: string
  specs: MediaSpec[]
  actions?: ReactNode
  /** Anything that hangs off the file, such as the below-profile warning. */
  children?: ReactNode
}) {
  const name = path.split('/').pop() || path

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>File</CardTitle>
        {actions && (
          <CardAction className="flex flex-wrap items-center justify-end gap-2">
            {actions}
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="readout truncate text-sm font-medium" title={path}>
          {name}
        </p>
        <MediaSpecs specs={specs} />
        {children}
      </CardContent>
    </Card>
  )
}
