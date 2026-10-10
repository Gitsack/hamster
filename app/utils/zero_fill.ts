import * as fs from 'node:fs/promises'

/**
 * SABnzbd fills articles it could not fetch with zeros and still writes the
 * file out, so a release with missing articles has a normal size, a valid
 * header and a correct duration — ffprobe passes it — while playback dies the
 * moment it reaches the hole. A Matrix (1999) import carried a 60 MiB hole
 * four minutes in this way.
 *
 * Sampling one small block every 16 MiB finds holes that size without
 * reading the whole file back off the share. Each read is an SMB round trip
 * (~30 ms), so samples are read in parallel batches. A single run of zeros can be
 * legitimate (Matroska Void padding near the header and cues), so a hole is
 * only reported when consecutive samples are all zeros, and the first and
 * last few MiB are skipped.
 */
const SAMPLE_BYTES = 4096
const SAMPLE_STRIDE = 16 * 1024 * 1024
const EDGE_SKIP = 8 * 1024 * 1024
const CONSECUTIVE_ZERO_SAMPLES = 2
const PARALLEL_READS = 8

function isAllZero(buf: Buffer, length: number): boolean {
  for (let i = 0; i < length; i++) {
    if (buf[i] !== 0) return false
  }
  return true
}

/**
 * Byte offset of the first zero-filled region of at least one sample stride,
 * or null when none is found. Files too small to sample are reported clean.
 */
export async function findZeroFilledRegion(filePath: string): Promise<number | null> {
  const handle = await fs.open(filePath, 'r')
  try {
    const { size } = await handle.stat()
    const end = size - EDGE_SKIP
    const offsets: number[] = []
    for (let offset = EDGE_SKIP; offset + SAMPLE_BYTES <= end; offset += SAMPLE_STRIDE) {
      offsets.push(offset)
    }

    let run = 0
    let runStart = 0
    for (let i = 0; i < offsets.length; i += PARALLEL_READS) {
      const batch = offsets.slice(i, i + PARALLEL_READS)
      const zeroed = await Promise.all(
        batch.map(async (offset) => {
          const buf = Buffer.alloc(SAMPLE_BYTES)
          const { bytesRead } = await handle.read(buf, 0, SAMPLE_BYTES, offset)
          return bytesRead > 0 && isAllZero(buf, bytesRead)
        })
      )
      for (const [j, isZero] of zeroed.entries()) {
        if (!isZero) {
          run = 0
          continue
        }
        if (run === 0) runStart = batch[j]
        run++
        if (run >= CONSECUTIVE_ZERO_SAMPLES) return runStart
      }
    }
    return null
  } finally {
    await handle.close()
  }
}

export function describeZeroFill(offset: number): string {
  return `contains zero-filled data at ${Math.round(offset / 1024 / 1024)} MiB — the download is missing articles and will not play past that point`
}
