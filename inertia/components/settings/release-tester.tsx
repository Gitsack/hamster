import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { releaseBadges, type AnnotatedRelease } from '@/components/release-list'
import { cn } from '@/lib/utils'

const TONE_CLASS = {
  neutral: 'border-border text-muted-foreground',
  good: 'border-status-complete-ink/40 text-status-complete-ink',
  bad: 'border-status-failed-ink/50 text-status-failed-ink',
} as const

interface Props {
  profileId: number | string
  mediaType: string
}

/**
 * Paste a release name, see the verdict.
 *
 * Quality rules are otherwise unfalsifiable from the settings screen: you find
 * out a rule was wrong days later, when the wrong file has already landed. This
 * turns the rules into something you can check in five seconds.
 */
export function ReleaseTester({ profileId, mediaType }: Props) {
  const [title, setTitle] = useState('')
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<AnnotatedRelease | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runTest = async () => {
    if (!title.trim()) return
    setTesting(true)
    setError(null)
    try {
      const response = await fetch(`/api/v1/qualityprofiles/${profileId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), mediaType }),
      })
      if (response.ok) {
        setResult(await response.json())
      } else {
        const data = await response.json().catch(() => ({}))
        setError(data.error || 'Could not test this release name')
        setResult(null)
      }
    } catch {
      setError('Hamster is unreachable — try again')
      setResult(null)
    } finally {
      setTesting(false)
    }
  }

  return (
    <fieldset className="space-y-3 border-t border-border pt-6">
      <legend className="sr-only">Test a release name</legend>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Test a release name</h3>
        <p className="text-xs text-muted-foreground">
          Checks against the profile as last saved. Save your changes first to test them.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Label htmlFor="release-test-input" className="sr-only">
          Release name
        </Label>
        <Input
          id="release-test-input"
          className="readout"
          placeholder="Movie.2024.1080p.HDTS.x264-GRP"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              runTest()
            }
          }}
        />
        <Button variant="outline" onClick={runTest} disabled={testing || !title.trim()}>
          {testing ? <Spinner className="size-4" /> : 'Test'}
        </Button>
      </div>

      {error && <p className="text-xs text-status-failed-ink">{error}</p>}

      {result && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <p
            className={cn(
              'text-sm font-medium',
              result.accepted ? 'text-status-complete-ink' : 'text-status-failed-ink'
            )}
          >
            {result.accepted ? 'Accepted' : 'Rejected'}
            {result.quality?.name ? ` — ${result.quality.name}` : ''}
          </p>

          <div className="flex flex-wrap gap-1.5">
            {releaseBadges(result).map((badge, index) => (
              <Badge
                key={`${badge.label}-${index}`}
                variant="outline"
                className={cn('readout text-[0.6875rem]', TONE_CLASS[badge.tone])}
                title={badge.hint}
              >
                {badge.label}
              </Badge>
            ))}
          </div>

          {!result.accepted && (result.rejections?.length ?? 0) > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {result.rejections!.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </fieldset>
  )
}
