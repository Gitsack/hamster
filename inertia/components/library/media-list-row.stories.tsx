import type { Meta, StoryObj } from '@storybook/react'
import { action } from 'storybook/actions'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Album01Icon,
  CheckmarkCircle01Icon,
  Film01Icon,
  MusicNote01Icon,
} from '@hugeicons/core-free-icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MediaListRow } from './media-list-row'

const meta: Meta<typeof MediaListRow> = {
  component: MediaListRow,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '52rem' }}>
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof MediaListRow>

const addButton = (
  <Button size="sm" onClick={action('add')}>
    <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-1" />
    Add
  </Button>
)

const inLibraryBadge = (
  <Badge variant="outline" className="gap-1 text-xs">
    <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-3 w-3" />
    In Library
  </Badge>
)

/** A library row: the artwork and the title navigate to the detail page. */
export const LibraryRow: Story = {
  args: {
    icon: Film01Icon,
    imageUrl: 'https://image.tmdb.org/t/p/w200/9O1Iy9od7uGuOJRPjElQuRlfoXX.jpg',
    title: 'Blade Runner 2049',
    subtitle: '2017 • 164 min',
    subtitleClassName: 'readout',
    href: '/movie/1',
    actions: <Badge variant="outline">Released</Badge>,
  },
}

/** A search result: the whole row opens the preview sheet, and the trailing button adds. */
export const SearchResult: Story = {
  args: {
    icon: Film01Icon,
    imageUrl: 'https://image.tmdb.org/t/p/w200/9O1Iy9od7uGuOJRPjElQuRlfoXX.jpg',
    title: 'Blade Runner 2049',
    subtitle: '2017 · 8.0 rating',
    onActivate: action('open preview'),
    actions: addButton,
  },
}

/** Already held: the row reads as secondary and offers no add. */
export const AlreadyInLibrary: Story = {
  args: {
    ...SearchResult.args,
    dimmed: true,
    actions: inLibraryBadge,
  },
}

/** Nothing on disk yet: the artwork stays desaturated until the row is hovered. */
export const NotRequested: Story = {
  args: {
    ...LibraryRow.args,
    mutedArtwork: true,
  },
}

/** No artwork from the provider — the media icon holds the frame. */
export const WithoutArtwork: Story = {
  args: {
    icon: MusicNote01Icon,
    artworkAspect: 'aspect-square',
    title: 'Boards of Canada',
    subtitle: 'Group · GB',
    actions: addButton,
  },
}

/** Square artwork with a panel below the row, as the album search results use. */
export const SquareWithExpandedPanel: Story = {
  args: {
    icon: Album01Icon,
    artworkAspect: 'aspect-square',
    imageUrl:
      'https://coverartarchive.org/release-group/f5093c06-23e3-404f-aeaa-40f72885ee3a/front-250',
    title: 'OK Computer',
    subtitle: 'Radiohead · 1997',
    actions: addButton,
    expanded: (
      <div className="border-border border-t p-3">
        <h4 className="mb-2 text-sm font-medium">Tracks</h4>
        <div className="space-y-1">
          {['Airbag', 'Paranoid Android', 'Subterranean Homesick Alien'].map((track, i) => (
            <div key={track} className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm">
              <span className="readout text-muted-foreground w-6 text-right">{i + 1}.</span>
              <span className="flex-1 truncate">{track}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
}
