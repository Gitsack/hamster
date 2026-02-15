import Tag from '#models/tag'

let counter = 0

export class TagFactory {
  static async create(
    overrides: Partial<{
      name: string
    }> = {}
  ) {
    counter++
    return await Tag.create({
      name: overrides.name ?? `test-tag-${counter}`,
    })
  }
}
