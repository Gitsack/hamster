import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ReleaseList, type AnnotatedRelease } from '@/components/release-list'
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
    expect(screen.getByText(/Replace Movie/)).toBeTruthy()
  })
})
