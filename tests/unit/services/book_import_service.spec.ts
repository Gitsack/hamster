import path from 'node:path'
import { test } from '@japa/runner'

// Replicate private findPreferredBookFile from BookImportService
function findPreferredBookFile(files: string[]): string | null {
  if (files.length === 0) return null
  const priority: Record<string, number> = {
    '.epub': 1,
    '.mobi': 2,
    '.azw3': 3,
    '.azw': 4,
    '.pdf': 5,
    '.fb2': 6,
    '.djvu': 7,
    '.cbz': 8,
    '.cbr': 9,
  }
  const sorted = [...files].sort((a, b) => {
    const extA = path.extname(a).toLowerCase()
    const extB = path.extname(b).toLowerCase()
    return (priority[extA] || 100) - (priority[extB] || 100)
  })
  return sorted[0]
}

test.group('BookImportService | findPreferredBookFile', () => {
  test('returns null for empty array', ({ assert }) => {
    assert.isNull(findPreferredBookFile([]))
  })

  test('returns the single file when only one provided', ({ assert }) => {
    assert.equal(findPreferredBookFile(['book.pdf']), 'book.pdf')
  })

  test('prefers EPUB over PDF', ({ assert }) => {
    assert.equal(findPreferredBookFile(['book.pdf', 'book.epub']), 'book.epub')
  })

  test('prefers MOBI over PDF', ({ assert }) => {
    assert.equal(findPreferredBookFile(['book.pdf', 'book.mobi']), 'book.mobi')
  })

  test('prefers EPUB over MOBI', ({ assert }) => {
    assert.equal(findPreferredBookFile(['book.mobi', 'book.epub']), 'book.epub')
  })

  test('prefers AZW3 over AZW', ({ assert }) => {
    assert.equal(findPreferredBookFile(['book.azw', 'book.azw3']), 'book.azw3')
  })

  test('prefers PDF over FB2', ({ assert }) => {
    assert.equal(findPreferredBookFile(['book.fb2', 'book.pdf']), 'book.pdf')
  })

  test('prefers CBZ over CBR', ({ assert }) => {
    assert.equal(findPreferredBookFile(['book.cbr', 'book.cbz']), 'book.cbz')
  })

  test('unknown extensions get lowest priority', ({ assert }) => {
    assert.equal(findPreferredBookFile(['book.txt', 'book.pdf']), 'book.pdf')
  })

  test('unknown extension returned when only unknown files', ({ assert }) => {
    assert.equal(findPreferredBookFile(['book.txt', 'book.doc']), 'book.txt')
  })

  test('selects EPUB from a large mixed list', ({ assert }) => {
    const files = ['book.cbr', 'book.pdf', 'book.mobi', 'book.epub', 'book.djvu']
    assert.equal(findPreferredBookFile(files), 'book.epub')
  })

  test('handles case-insensitive extensions', ({ assert }) => {
    assert.equal(findPreferredBookFile(['book.PDF', 'book.EPUB']), 'book.EPUB')
  })
})
