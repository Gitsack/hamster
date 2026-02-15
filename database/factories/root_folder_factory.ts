import RootFolder from '#models/root_folder'
import type { MediaType } from '#models/app_setting'
import type { ScanStatus } from '#models/root_folder'

let counter = 0

export class RootFolderFactory {
  static async create(
    overrides: Partial<{
      name: string
      path: string
      mediaType: MediaType
      accessible: boolean
      scanStatus: ScanStatus
    }> = {}
  ) {
    counter++
    return await RootFolder.create({
      name: overrides.name ?? `Test Root Folder ${counter}`,
      path: overrides.path ?? `/media/test-root-${counter}`,
      mediaType: overrides.mediaType ?? 'music',
      accessible: overrides.accessible ?? true,
      scanStatus: overrides.scanStatus ?? 'idle',
    })
  }
}
