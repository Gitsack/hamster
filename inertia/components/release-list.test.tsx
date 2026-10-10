import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ReleaseList, releaseBadges, type AnnotatedRelease } from '@/components/release-list'
import { ReplaceFileDialog } from '@/components/library/replace-file-dialog'

const base = {
  name: null,
  resolution: '1080p',
  source: 'WEB',
  codec: 'x264',
  audioCodec: 'AAC',
  audioChannels: 2,
  audioTier: 'lossy-sd',
  hdr: null,
  bitDepth: null,
  isRemux: false,
  isProper: false,
  isRepack: false,
  isUpscaled: false,
  hasHardcodedSubs: false,
  isJunkSource: false,
  junkSourceLabel: null,
  releaseGroup: 'GRP',
}

const releases: AnnotatedRelease[] = [
  {
    id: 'a',
    title: 'A.2024.1080p.WEB.AAC2.0-GRP',
    size: 2e9,
    indexer: 'i',
    downloadUrl: 'u',
    accepted: true,
    rejections: [],
    customFormats: [],
    score: 10,
    quality: base,
  },
  {
    id: 'b',
    title: 'B.2024.2160p.HDTS-GRP',
    size: 9e9,
    indexer: 'i',
    downloadUrl: 'u',
    accepted: false,
    rejections: ['Release is a TELESYNC rip'],
    customFormats: [],
    score: -900,
    quality: { ...base, resolution: '2160p', isJunkSource: true, junkSourceLabel: 'TELESYNC' },
  },
]

/**
 * The picker is what stands between a person and a bad grab, so it has to
 * render both shapes it is handed: a release the profile accepted, and one it
 * refused with reasons attached.
 */
describe('ReleaseList', () => {
  it('renders inside DialogContent', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Search</DialogTitle>
          </DialogHeader>
          <ReleaseList releases={releases} onGrab={() => {}} />
        </DialogContent>
      </Dialog>
    )
    expect(screen.getByText('B.2024.2160p.HDTS-GRP')).toBeTruthy()
  })

  it('filters by size with the range slider', () => {
    const sized = (id: string, size: number): AnnotatedRelease => ({
      ...releases[0],
      id,
      title: `${id}.release`,
      size,
    })
    render(
      <ReleaseList
        releases={[sized('small', 1e9), sized('mid', 8e9), sized('big', 60e9)]}
        onGrab={() => {}}
      />
    )
    expect(screen.getByText('3 of 3')).toBeTruthy()

    // Pull the upper thumb all the way down: only the smallest release fits.
    fireEvent.keyDown(screen.getByLabelText('Maximum size'), { key: 'Home' })
    expect(screen.getByText('1 of 3')).toBeTruthy()
    expect(screen.getByText('small.release')).toBeTruthy()
    expect(screen.queryByText('big.release')).toBeNull()
  })

  it('orders resolution chips by height, lowest first', () => {
    const at = (id: string, resolution: string): AnnotatedRelease => ({
      ...releases[0],
      id,
      title: `${id}.${resolution}`,
      quality: { ...base, resolution },
    })
    render(
      <ReleaseList
        releases={[at('a', '2160p'), at('b', '720p'), at('c', '1080p')]}
        onGrab={() => {}}
      />
    )
    const chips = screen.getByRole('group', { name: 'Filter by resolution' })
    const labels = Array.from(chips.querySelectorAll('button')).map((b) => b.textContent)
    expect(labels).toEqual(['Any', '720p', '1080p', '2160p'])
  })

  // The movie page mounts the list twice — once inline under the page, once in
  // the picker dialog — and both are live at the same time.
  it('renders two instances at once, like the movie page does', () => {
    render(
      <>
        <ReleaseList releases={releases} onGrab={() => {}} />
        <Dialog open>
          <DialogContent>
            <ReleaseList releases={releases} loading grabbingId={null} onGrab={() => {}} />
          </DialogContent>
        </Dialog>
      </>
    )
  })

  it('renders the replace dialog', () => {
    render(
      <ReplaceFileDialog
        open
        onOpenChange={() => {}}
        subject="Movie"
        currentSummary="1080p · AAC 2.0"
        onConfirm={() => {}}
      />
    )
    expect(screen.getByText(/Re-download Movie/)).toBeTruthy()
  })
})

describe('releaseBadges | languages', () => {
  const badge = (quality: Partial<typeof base>) =>
    releaseBadges({
      id: 'x',
      title: 't',
      size: 1,
      indexer: 'i',
      downloadUrl: 'u',
      quality: { ...base, ...quality },
    }).map((b) => b.label)

  it('names the audio languages the title claims', () => {
    expect(badge({ languages: ['de', 'en'] })).toContain('DE/EN')
  })

  it('says MULTI when the title claims tracks it does not name', () => {
    expect(badge({ languages: [], isMultiAudio: true })).toContain('MULTI')
  })

  it('marks a subtitle language as subtitles, not as audio', () => {
    // VOSTFR: French subs over the original audio. A bare "FR" here would be
    // the badge that gets someone the wrong file.
    const labels = badge({ languages: [], subtitleLanguages: ['fr'] })
    expect(labels).toContain('FR subs')
    expect(labels).not.toContain('FR')
  })
})
