import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { shouldRequestNewAlbum, shouldRequestNewBook } from '#services/library/release_follow'

const followedSince = DateTime.fromISO('2026-06-15T12:00:00Z')
const followed = { monitored: true, monitoredAt: followedSince }
const notFollowed = { monitored: false, monitoredAt: null }

test.group('release_follow', () => {
  test("requests a followed artist's studio album released after following started", ({
    assert,
  }) => {
    const album = { releaseDate: DateTime.fromISO('2026-06-15'), albumType: 'album' }
    assert.isTrue(shouldRequestNewAlbum(followed, album))
    assert.isTrue(shouldRequestNewAlbum(followed, { ...album, albumType: 'ep' }))
  })

  test('never requests the back catalogue, undated or non-studio releases', ({ assert }) => {
    const base = { releaseDate: DateTime.fromISO('2026-07-01'), albumType: 'album' }
    assert.isFalse(
      shouldRequestNewAlbum(followed, { ...base, releaseDate: DateTime.fromISO('2019-01-01') })
    )
    assert.isFalse(shouldRequestNewAlbum(followed, { ...base, releaseDate: null }))
    assert.isFalse(shouldRequestNewAlbum(followed, { ...base, albumType: 'single' }))
    assert.isFalse(shouldRequestNewAlbum(followed, { ...base, secondaryTypes: ['Compilation'] }))
    assert.isFalse(shouldRequestNewAlbum(notFollowed, base))
  })

  test('books follow by first publication year', ({ assert }) => {
    assert.isTrue(shouldRequestNewBook(followed, 2026))
    assert.isFalse(shouldRequestNewBook(followed, 2025))
    assert.isFalse(shouldRequestNewBook(followed, undefined))
    assert.isFalse(shouldRequestNewBook(notFollowed, 2027))
  })
})
