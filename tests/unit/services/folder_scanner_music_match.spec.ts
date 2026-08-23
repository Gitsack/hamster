import { test } from '@japa/runner'
import { normalizeForCompare } from '#services/tasks/folder_scanner'

/**
 * Guards the artist check that decides whether a MusicBrainz search result is
 * actually the release in the folder.
 *
 * MusicBrainz returns loose title matches, so without an artist check a music
 * video like "Megan Thee Stallion ft Dua Lipa-Sweetest Pie-DDC-1080p-x264" could
 * resolve to an unrelated album and be created as a library entry — which is how
 * three music videos ended up in the movies library.
 */

/** Mirrors the containment test in lookupAlbumMusicBrainz. */
function artistMatches(folderArtist: string, candidateArtist: string): boolean {
  const wanted = normalizeForCompare(folderArtist)
  const found = normalizeForCompare(candidateArtist)
  return found === wanted || found.includes(wanted) || wanted.includes(found)
}

test.group('folder_scanner | normalizeForCompare', () => {
  test('collapses case, punctuation and separators', ({ assert }) => {
    assert.equal(normalizeForCompare('Dua.Lipa'), 'dua lipa')
    assert.equal(normalizeForCompare('Dua_Lipa'), 'dua lipa')
    assert.equal(normalizeForCompare('DUA  LIPA'), 'dua lipa')
    assert.equal(normalizeForCompare("Guns N' Roses"), 'guns n roses')
    assert.equal(normalizeForCompare('  Sigur Rós!  '), 'sigur rs')
  })

  test('is stable for an already-normal name', ({ assert }) => {
    assert.equal(normalizeForCompare('dua lipa'), 'dua lipa')
  })
})

test.group('folder_scanner | album artist matching', () => {
  test('accepts an exact artist match', ({ assert }) => {
    assert.isTrue(artistMatches('Dua Lipa', 'Dua Lipa'))
    assert.isTrue(artistMatches('Dua.Lipa', 'Dua Lipa'))
  })

  test('accepts a featured-artist credit containing the real artist', ({ assert }) => {
    // Folder credits a feature; MusicBrainz returns the primary artist.
    assert.isTrue(artistMatches('Megan Thee Stallion ft Dua Lipa', 'Megan Thee Stallion'))
    assert.isTrue(artistMatches('Calvin Harris ft Dua Lipa And Young Thug', 'Calvin Harris'))
  })

  test('rejects an unrelated artist', ({ assert }) => {
    // The failure mode being guarded: a loose title hit by someone else.
    assert.isFalse(artistMatches('Megan Thee Stallion ft Dua Lipa', 'The Beatles'))
    assert.isFalse(artistMatches('Dua Lipa', 'Elton John'))
    assert.isFalse(artistMatches('Calvin Harris', 'Taylor Swift'))
  })
})
