import { test } from '@japa/runner'
import { createLibraryFileFilter } from '../../../app/services/media/version_files.js'

test.group('version files | library scan filter', () => {
  const filter = createLibraryFileFilter(
    ['Show/Season 01/Show - S01E01 - Pilot - Mobile.mkv'],
    ['Mobile', 'Tablet']
  )

  test('a recorded version is not a main file', ({ assert }) => {
    assert.isTrue(filter.isNotMainFile('Show/Season 01/Show - S01E01 - Pilot - Mobile.mkv'))
  })

  test('a file ending in a profile label is not one either, recorded or not yet', ({ assert }) => {
    assert.isTrue(filter.isNotMainFile('Movie (2020)/Movie (2020) - Tablet.mkv'))
    assert.isTrue(filter.isNotMainFile('Movie (2020)/Movie (2020) - mobile.MKV'))
  })

  test("Hamster's work files are skipped", ({ assert }) => {
    assert.isTrue(
      filter.isNotMainFile('Show/Season 01/Show - S01E06 - Rocked.mkv.hamster-prune.mkv')
    )
  })

  test('main files pass, including titles that merely contain a label', ({ assert }) => {
    assert.isFalse(filter.isNotMainFile('Movie (2020)/Movie (2020).mkv'))
    assert.isFalse(filter.isNotMainFile('Show/Season 01/Show - S01E01 - Pilot.mkv'))
    assert.isFalse(filter.isNotMainFile('Mobile Suit (2020)/Mobile Suit (2020).mkv'))
    assert.isFalse(filter.isNotMainFile('Movie (2020)/Movie (2020) - Mobile.mp4'))
  })
})
