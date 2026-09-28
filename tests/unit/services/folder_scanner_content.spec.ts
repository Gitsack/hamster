import { test } from '@japa/runner'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { folderScanner } from '#services/tasks/folder_scanner'

type HoldsMediaFor = (
  folderPath: string,
  type: 'movie' | 'episode' | 'album' | 'book'
) => Promise<boolean>

/**
 * A folder matched to a library item by name is only imported when it holds
 * that item's kind of media. Concert videos matched to albums used to fail with
 * "No audio files found" and were recreated as failures on every scan.
 */
test.group('FolderScanner.holdsMediaFor', (group) => {
  let root: string
  const holdsMediaFor = (folderPath: string, type: Parameters<HoldsMediaFor>[1]) =>
    (folderScanner as unknown as { holdsMediaFor: HoldsMediaFor }).holdsMediaFor.call(
      folderScanner,
      folderPath,
      type
    )

  async function folder(name: string, files: string[]): Promise<string> {
    const dir = path.join(root, name)
    await fs.mkdir(dir, { recursive: true })
    for (const file of files) {
      await fs.mkdir(path.dirname(path.join(dir, file)), { recursive: true })
      await fs.writeFile(path.join(dir, file), '')
    }
    return dir
  }

  group.setup(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'hamster-holds-media-'))
    return () => fs.rm(root, { recursive: true, force: true })
  })

  test('a music video matched to an album is not importable as that album', async ({ assert }) => {
    const dir = await folder('Britney Spears - Criminal (Blu-ray) BD-1080P', [
      'Britney Spears - Criminal (Blu-ray) BD-1080P.m2ts',
      'cover.PNG',
      'info.txt',
    ])
    assert.isFalse(await holdsMediaFor(dir, 'album'))
    assert.isTrue(await holdsMediaFor(dir, 'movie'))
  })

  test('an album with a bonus video still imports as an album', async ({ assert }) => {
    const dir = await folder('Artist - Album (2024) FLAC', [
      'CD1/01 - Track.flac',
      'CD1/02 - Track.flac',
      'Bonus/making-of.mkv',
    ])
    assert.isTrue(await holdsMediaFor(dir, 'album'))
  })

  test('an audio-only folder is not importable as a movie or a book', async ({ assert }) => {
    const dir = await folder('Some Soundtrack 2020', ['01.mp3', '02.mp3'])
    assert.isFalse(await holdsMediaFor(dir, 'movie'))
    assert.isFalse(await holdsMediaFor(dir, 'episode'))
    assert.isFalse(await holdsMediaFor(dir, 'book'))
  })
})
