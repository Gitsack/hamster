import Indexer from '#models/indexer'
import type { IndexerType, IndexerSettings } from '#models/indexer'

let counter = 0

export class IndexerFactory {
  static async create(
    overrides: Partial<{
      name: string
      type: IndexerType
      enabled: boolean
      priority: number
      settings: IndexerSettings
      supportsSearch: boolean
      supportsRss: boolean
      prowlarrIndexerId: number | null
    }> = {}
  ) {
    counter++
    return await Indexer.create({
      name: overrides.name ?? `Test Indexer ${counter}`,
      type: overrides.type ?? 'newznab',
      enabled: overrides.enabled ?? true,
      priority: overrides.priority ?? 25,
      settings: overrides.settings ?? { baseUrl: 'http://localhost', apiKey: 'test-key' },
      supportsSearch: overrides.supportsSearch ?? true,
      supportsRss: overrides.supportsRss ?? true,
      prowlarrIndexerId: overrides.prowlarrIndexerId ?? null,
    })
  }
}
