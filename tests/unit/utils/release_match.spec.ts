import { test } from '@japa/runner'
import { isAlbumRelease, isBookRelease, isPackRelease } from '#utils/release_match'

test.group('release_match / albums', () => {
  test('accepts ordinary releases of the album', ({ assert }) => {
    const ok = [
      'Radiohead - OK Computer (1997) [FLAC]',
      'Radiohead-OK_Computer-CD-FLAC-1997-GRP',
      'Radiohead - OK Computer (Remastered) 2009 FLAC',
      'Radiohead OK Computer 320kbps',
      'Radiohead - OK Computer',
    ]
    for (const title of ok) {
      assert.isTrue(isAlbumRelease(title, 'Radiohead', 'OK Computer'), title)
    }
  })

  test('rejects discographies and collection packs', ({ assert }) => {
    const packs = [
      'Radiohead - Discography (1993-2016) [FLAC]',
      'Radiohead - Complete Studio Albums incl. OK Computer',
      'Radiohead - 9 Albums [MP3 320]',
      'Radiohead Collection OK Computer Kid A Amnesiac',
      'Radiohead - Box Set - OK Computer',
      'Radiohead 1993-2016 OK Computer',
    ]
    for (const title of packs) {
      assert.isFalse(isAlbumRelease(title, 'Radiohead', 'OK Computer'), title)
    }
  })

  test('rejects other artists and longer titles', ({ assert }) => {
    assert.isFalse(isAlbumRelease('Muse - OK Computer Tribute (2007)', 'Radiohead', 'OK Computer'))
    assert.isFalse(
      isAlbumRelease("Taylor Swift - Red (Taylor's Version) 2021", 'Taylor Swift', 'Red')
    )
    assert.isFalse(isAlbumRelease('The Beatles - Abbey Road Sessions', 'The Beatles', 'Abbey Road'))
  })

  test('handles "The" artists, self-titled albums and edition suffixes', ({ assert }) => {
    assert.isTrue(isAlbumRelease('Beatles - Abbey Road 1969 FLAC', 'The Beatles', 'Abbey Road'))
    assert.isTrue(isAlbumRelease('Weezer - Weezer (1994) [FLAC]', 'Weezer', 'Weezer'))
    assert.isTrue(
      isAlbumRelease(
        'Oasis - Definitely Maybe 1994 FLAC',
        'Oasis',
        'Definitely Maybe (Deluxe Edition)'
      )
    )
    assert.isTrue(isAlbumRelease('Beyonce - Lemonade 2016', 'Beyoncé', 'Lemonade'))
  })

  test('an album that is itself a collection still matches', ({ assert }) => {
    assert.isTrue(
      isAlbumRelease(
        'Sade - The Best of Sade Collection 1994',
        'Sade',
        'The Best of Sade Collection'
      )
    )
    assert.isFalse(
      isPackRelease('Queen - Greatest Hits I II III 1970-2000', 'Greatest Hits 1970-2000', 'music')
    )
  })
})

test.group('release_match / books', () => {
  test('accepts the book in either author order', ({ assert }) => {
    assert.isTrue(
      isBookRelease('J.R.R. Tolkien - The Hobbit (epub)', 'J.R.R. Tolkien', 'The Hobbit')
    )
    assert.isTrue(
      isBookRelease('The Hobbit by Tolkien, J.R.R. [retail]', 'J. R. R. Tolkien', 'The Hobbit')
    )
    assert.isTrue(
      isBookRelease('Frank Herbert - Dune (2005) epub', 'Frank Herbert', 'Dune: Deluxe Edition')
    )
  })

  test('rejects collections and other authors', ({ assert }) => {
    const rejected = [
      'J.K. Rowling - Harry Potter Complete Series (Books 1-7) epub',
      'J.K. Rowling - Harry Potter Box Set',
      "J.K. Rowling - 7 Books Harry Potter and the Philosopher's Stone",
      "Harry Potter and the Philosopher's Stone - Fan Guide by Someone Else",
    ]
    for (const title of rejected) {
      assert.isFalse(
        isBookRelease(title, 'J.K. Rowling', "Harry Potter and the Philosopher's Stone"),
        title
      )
    }
  })
})
