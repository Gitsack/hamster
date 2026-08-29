import { render, screen } from '@testing-library/react'
import { fileFacts, MediaFileCard } from './media-file-card'

describe('fileFacts', () => {
  it('splits joined summaries into separate facts', () => {
    expect(fileFacts(['Bluray-720p', '8.4 GB', '720p · h264 · EAC3 5.1'])).toEqual([
      'Bluray-720p',
      '8.4 GB',
      'h264',
      'EAC3 5.1',
    ])
  })

  it('drops a fact an earlier one already spells out', () => {
    expect(fileFacts(['WEBDL-1080p', '1080p · x265'])).toEqual(['WEBDL-1080p', 'x265'])
  })

  it('ignores missing pieces', () => {
    expect(fileFacts([null, '3.1 GB', undefined])).toEqual(['3.1 GB'])
  })
})

describe('MediaFileCard', () => {
  const specs = [
    { label: 'Quality', value: 'Bluray-1080p' },
    { label: 'Size', value: '1.2 GB', mono: true },
    { label: 'Audio', value: null },
  ]

  it('shows the file name and keeps the full path on its tooltip', () => {
    render(<MediaFileCard path="/media/movies/Arrival (2016)/Arrival.mkv" specs={specs} />)

    const name = screen.getByText('Arrival.mkv')
    expect(name).toHaveAttribute('title', '/media/movies/Arrival (2016)/Arrival.mkv')
    expect(screen.queryByText('/media/movies/Arrival (2016)/Arrival.mkv')).not.toBeInTheDocument()
  })

  it('labels the measurements and skips the ones the probe did not answer', () => {
    render(<MediaFileCard path="/media/movies/Arrival.mkv" specs={specs} />)

    expect(screen.getByText('Quality')).toBeInTheDocument()
    expect(screen.getByText('Bluray-1080p')).toBeInTheDocument()
    expect(screen.queryByText('Audio')).not.toBeInTheDocument()
  })
})
