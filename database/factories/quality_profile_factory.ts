import QualityProfile from '#models/quality_profile'
import type { QualityItem } from '#models/quality_profile'

let counter = 0

export class QualityProfileFactory {
  static async create(
    overrides: Partial<{
      name: string
      mediaType: string | null
      cutoff: number
      items: QualityItem[]
      upgradeAllowed: boolean
    }> = {}
  ) {
    counter++
    return await QualityProfile.create({
      name: overrides.name ?? `Test Quality Profile ${counter}`,
      mediaType: overrides.mediaType ?? null,
      cutoff: overrides.cutoff ?? 1,
      items: overrides.items ?? [{ id: 1, name: 'Default', allowed: true }],
      upgradeAllowed: overrides.upgradeAllowed ?? true,
    })
  }
}
