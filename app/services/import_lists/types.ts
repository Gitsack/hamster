export interface ImportListItem {
  title: string
  year: number | null
  imdbId: string | null
  tmdbId: number | null
  mediaType: 'movie' | 'show'
}
