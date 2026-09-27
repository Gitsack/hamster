import Movie from '#models/movie'
import Episode from '#models/episode'
import Album from '#models/album'
import Book from '#models/book'

/** Whether a matched library item already has its file on disk. */
export async function libraryItemHasFile(match: { type: string; id: string }): Promise<boolean> {
  switch (match.type) {
    case 'movie': {
      const movie = await Movie.find(match.id)
      return movie?.hasFile ?? false
    }
    case 'episode': {
      const episode = await Episode.find(match.id)
      return episode?.hasFile ?? false
    }
    case 'album': {
      const album = await Album.query().where('id', match.id).preload('trackFiles').first()
      return (album?.trackFiles?.length ?? 0) > 0
    }
    case 'book': {
      const book = await Book.find(match.id)
      return book?.hasFile ?? false
    }
    default:
      return false
  }
}
