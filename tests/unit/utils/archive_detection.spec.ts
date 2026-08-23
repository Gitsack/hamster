import { test } from '@japa/runner'
import {
  hasPendingArchives,
  describeMissingMedia,
  NOT_UNPACKED_ERROR,
} from '#utils/archive_detection'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'

async function makeTree(files: string[]): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'archive-detect-'))
  for (const rel of files) {
    const full = path.join(root, rel)
    await fs.mkdir(path.dirname(full), { recursive: true })
    await fs.writeFile(full, 'x')
  }
  return root
}

test.group('archive_detection', (group) => {
  const created: string[] = []

  group.teardown(async () => {
    for (const dir of created) {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  const track = async (files: string[]) => {
    const dir = await makeTree(files)
    created.push(dir)
    return dir
  }

  test('detects an old-style multipart RAR set', async ({ assert }) => {
    // The exact shape that was deleted as "no valid media files".
    const dir = await track([
      'Spider-Noir.S01E01/spider-noir.s01e01.rar',
      'Spider-Noir.S01E01/spider-noir.s01e01.r00',
      'Spider-Noir.S01E01/spider-noir.s01e01.r13',
      'Spider-Noir.S01E01/spider-noir.s01e01.nfo',
    ])
    assert.isTrue(await hasPendingArchives(dir))
  })

  test('detects a new-style .partNN.rar set', async ({ assert }) => {
    const dir = await track(['Movie/movie.part01.rar', 'Movie/movie.part02.rar'])
    assert.isTrue(await hasPendingArchives(dir))
  })

  test('detects zip and 7z', async ({ assert }) => {
    assert.isTrue(await hasPendingArchives(await track(['a/thing.zip'])))
    assert.isTrue(await hasPendingArchives(await track(['a/thing.7z'])))
  })

  test('returns false for an already-extracted folder', async ({ assert }) => {
    const dir = await track(['Show.S01E01/episode.mkv', 'Show.S01E01/episode.nfo'])
    assert.isFalse(await hasPendingArchives(dir))
  })

  test('returns false for a genuinely empty or junk folder', async ({ assert }) => {
    assert.isFalse(await hasPendingArchives(await track(['junk/readme.txt'])))
    assert.isFalse(await hasPendingArchives(await track([])))
  })

  test('returns false for a missing directory rather than throwing', async ({ assert }) => {
    assert.isFalse(await hasPendingArchives('/nonexistent/path/nowhere'))
  })

  test('does not mistake a .r-prefixed non-archive for a rar part', async ({ assert }) => {
    // .rb / .rs are source files, not RAR volumes.
    const dir = await track(['code/script.rb', 'code/main.rs'])
    assert.isFalse(await hasPendingArchives(dir))
  })

  test('describeMissingMedia distinguishes not-unpacked from truly empty', async ({ assert }) => {
    const archived = await track(['x/file.rar'])
    const empty = await track(['x/readme.txt'])

    assert.equal(await describeMissingMedia(archived, 'video'), NOT_UNPACKED_ERROR)
    assert.equal(await describeMissingMedia(empty, 'video'), 'No video files found in download')
    assert.equal(await describeMissingMedia(empty, 'audio'), 'No audio files found in download')
  })
})
