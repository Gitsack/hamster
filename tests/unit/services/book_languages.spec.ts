import { test } from '@japa/runner'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import zlib from 'node:zlib'
import {
  titleSpeaks,
  guessLanguage,
  normalizeLanguage,
  readEpubLanguage,
} from '#services/library/book_languages'

/** A minimal zip writer, enough to produce an EPUB for the reader. */
function zip(entries: Record<string, string>, deflate: boolean): Buffer {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const [name, text] of Object.entries(entries)) {
    const raw = Buffer.from(text)
    const data = deflate ? zlib.deflateRawSync(raw) : raw
    const nameBuf = Buffer.from(name)
    const crc = zlib.crc32(raw)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(deflate ? 8 : 0, 8)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(deflate ? 8 : 0, 10)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(raw.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt32LE(offset, 42)
    locals.push(local, nameBuf, data)
    centrals.push(central, nameBuf)
    offset += 30 + nameBuf.length + data.length
  }
  const directory = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(Object.keys(entries).length, 8)
  end.writeUInt16LE(Object.keys(entries).length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, directory, end])
}

const english =
  'As long ago as 340 B.C. Aristotle, in his book On the Heavens, was able to put forward two good arguments for believing that the Earth was a round ball rather than a flat plate. '
const german =
  'Der Darm ist ein Organ, das wir lange unterschätzt haben. Es ist nicht nur für die Verdauung zuständig, sondern auch für unser Wohlbefinden, und das zeigt sich auch in der Forschung. '

const epub = (language: string, body = '') => ({
  'mimetype': 'application/epub+zip',
  'META-INF/container.xml':
    '<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>',
  'OEBPS/content.opf': `<package><metadata><dc:title>X</dc:title><dc:language>${language}</dc:language></metadata></package>`,
  ...(body ? { 'OEBPS/chapter1.xhtml': `<html><body><p>${body}</p></body></html>` } : {}),
})

test.group('book languages', () => {
  test('normalizes ISO, regional and OpenLibrary (MARC) codes', ({ assert }) => {
    assert.equal(normalizeLanguage('en-US'), 'en')
    assert.equal(normalizeLanguage('de'), 'de')
    assert.equal(normalizeLanguage('/languages/ger'), 'de')
    assert.equal(normalizeLanguage('/languages/spa'), 'es')
    assert.equal(normalizeLanguage('fre'), 'fr')
    assert.isNull(normalizeLanguage('xyz'))
    assert.isNull(normalizeLanguage(null))
  })

  test('reads the language an EPUB declares, stored or deflated', async ({ assert }) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'epub-'))
    const stored = path.join(dir, 'a.epub')
    const deflated = path.join(dir, 'b.epub')
    await fs.writeFile(stored, zip(epub('de'), false))
    await fs.writeFile(deflated, zip(epub('en-GB'), true))
    assert.equal(await readEpubLanguage(stored), 'de')
    assert.equal(await readEpubLanguage(deflated), 'en')
    await fs.rm(dir, { recursive: true })
  })

  test('says nothing for an EPUB without a language', async ({ assert }) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'epub-'))
    const file = path.join(dir, 'c.epub')
    const entries = epub('')
    entries['OEBPS/content.opf'] = '<package><metadata><dc:title>X</dc:title></metadata></package>'
    await fs.writeFile(file, zip(entries, true))
    assert.isNull(await readEpubLanguage(file))
    await fs.rm(dir, { recursive: true })
  })

  test('guesses the language of a page of text, or declines', ({ assert }) => {
    assert.equal(guessLanguage(english.repeat(8)), 'en')
    assert.equal(guessLanguage(german.repeat(8)), 'de')
    assert.isNull(guessLanguage('Too short to say anything.'))
  })

  test('trusts the text over wrong metadata (a Dutch converter on an English book)', async ({
    assert,
  }) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'epub-'))
    const file = path.join(dir, 'd.epub')
    await fs.writeFile(file, zip(epub('nl', english.repeat(10)), true))
    assert.equal(await readEpubLanguage(file), 'en')
    await fs.rm(dir, { recursive: true })
  })

  test('lets a title decide when the language is unknown', ({ assert }) => {
    const readable = new Set(['en', 'de'])
    assert.isTrue(titleSpeaks('Good Food For Bad Days', readable))
    assert.isTrue(titleSpeaks('Der Hund und die Katze', readable))
    assert.isFalse(titleSpeaks('Olu Babalar Kulubu', readable))
    assert.isFalse(titleSpeaks('Raons per seguir vivint', readable))
  })
})
