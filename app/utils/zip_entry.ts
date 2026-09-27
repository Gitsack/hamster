import fs from 'node:fs/promises'
import zlib from 'node:zlib'

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50
/** End-of-central-directory record plus the longest possible zip comment. */
const EOCD_SEARCH = 22 + 0xffff

/**
 * Read single entries out of a zip file (an EPUB, say) without reading the
 * whole archive: the central directory from the end of the file, then only
 * the entries asked for. Stored and deflated entries; no zip64, no
 * encryption — which covers EPUBs.
 */
export async function readZipEntries(
  file: string,
  wanted: (name: string) => boolean,
  limit = Number.POSITIVE_INFINITY
): Promise<Map<string, Buffer>> {
  const out = new Map<string, Buffer>()
  const handle = await fs.open(file, 'r')
  try {
    const { size } = await handle.stat()
    const tailLength = Math.min(size, EOCD_SEARCH)
    const tail = Buffer.alloc(tailLength)
    await handle.read(tail, 0, tailLength, size - tailLength)

    let eocd = -1
    for (let i = tail.length - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === EOCD_SIGNATURE) {
        eocd = i
        break
      }
    }
    if (eocd < 0) throw new Error('Not a zip file')

    const directorySize = tail.readUInt32LE(eocd + 12)
    const directoryOffset = tail.readUInt32LE(eocd + 16)
    const directory = Buffer.alloc(directorySize)
    await handle.read(directory, 0, directorySize, directoryOffset)

    let p = 0
    while (p + 46 <= directory.length && directory.readUInt32LE(p) === CENTRAL_SIGNATURE) {
      const method = directory.readUInt16LE(p + 10)
      const compressedSize = directory.readUInt32LE(p + 20)
      const nameLength = directory.readUInt16LE(p + 28)
      const extraLength = directory.readUInt16LE(p + 30)
      const commentLength = directory.readUInt16LE(p + 32)
      const localOffset = directory.readUInt32LE(p + 42)
      const name = directory.toString('utf8', p + 46, p + 46 + nameLength)
      p += 46 + nameLength + extraLength + commentLength

      if (out.size >= limit) break
      if (!wanted(name)) continue

      const local = Buffer.alloc(30)
      await handle.read(local, 0, 30, localOffset)
      const dataStart = localOffset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28)
      const data = Buffer.alloc(compressedSize)
      await handle.read(data, 0, compressedSize, dataStart)

      if (method === 0) out.set(name, data)
      else if (method === 8) out.set(name, zlib.inflateRawSync(data))
    }
    return out
  } finally {
    await handle.close()
  }
}
