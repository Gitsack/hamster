import { test } from '@japa/runner'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { findZeroFilledRegion } from '#utils/zero_fill'

const MiB = 1024 * 1024

/** A file of non-zero bytes with the given [start, length) ranges zeroed. */
async function writeFile(dir: string, size: number, holes: Array<[number, number]> = []) {
  const buf = Buffer.alloc(size, 0xab)
  for (const [start, length] of holes) buf.fill(0, start, start + length)
  const file = path.join(dir, `f-${size}-${holes.length}-${Math.random()}.mkv`)
  await fs.writeFile(file, buf)
  return file
}

test.group('findZeroFilledRegion', (group) => {
  let dir: string

  group.setup(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hamster-zero-fill-'))
    return () => fs.rm(dir, { recursive: true, force: true })
  })

  test('finds a hole that spans two parallel read batches', async ({ assert }) => {
    // Batches of 8 samples: the 8th sample is 120 MiB, the 9th 136 MiB
    const file = await writeFile(dir, 192 * MiB, [[118 * MiB, 20 * MiB]])
    assert.equal(await findZeroFilledRegion(file), 120 * MiB)
  })

  test('reports a clean file as clean', async ({ assert }) => {
    assert.isNull(await findZeroFilledRegion(await writeFile(dir, 64 * MiB)))
  })

  test('finds a multi-MiB hole of missing articles', async ({ assert }) => {
    // Samples land every 16 MiB from 8 MiB; this hole covers 24 and 40 MiB
    const file = await writeFile(dir, 128 * MiB, [[20 * MiB, 40 * MiB]])
    assert.equal(await findZeroFilledRegion(file), 24 * MiB)
  })

  test('ignores a single zero run like Matroska Void padding', async ({ assert }) => {
    // Covers exactly one sample point (offset 24 MiB) and not the next
    const file = await writeFile(dir, 128 * MiB, [[24 * MiB - 1024, 1 * MiB]])
    assert.isNull(await findZeroFilledRegion(file))
  })

  test('ignores zeros in the header and trailer regions', async ({ assert }) => {
    const file = await writeFile(dir, 64 * MiB, [
      [0, 8 * MiB],
      [56 * MiB, 8 * MiB],
    ])
    assert.isNull(await findZeroFilledRegion(file))
  })

  test('treats files too small to sample as clean', async ({ assert }) => {
    assert.isNull(await findZeroFilledRegion(await writeFile(dir, 1 * MiB, [[0, 1 * MiB]])))
  })
})
