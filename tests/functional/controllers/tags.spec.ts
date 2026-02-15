import { test } from '@japa/runner'
import Tag from '#models/tag'
import MediaTag from '#models/media_tag'
import TagsController from '#controllers/tags_controller'
import { randomUUID } from 'node:crypto'

test.group('TagsController', (group) => {
  let tag1: Tag
  let tag2: Tag

  group.setup(async () => {
    tag1 = await Tag.create({ name: 'Tags Test Action' })
    tag2 = await Tag.create({ name: 'Tags Test Comedy' })
  })

  group.teardown(async () => {
    await MediaTag.query().whereIn('tagId', [tag1.id, tag2.id]).delete()
    await Tag.query().whereIn('id', [tag1.id, tag2.id]).delete()
    await Tag.query().where('name', 'like', 'Tags Test%').delete()
  })

  // ---- index ----

  test('index returns list of tags with media counts', async ({ assert }) => {
    const controller = new TagsController()
    let result: unknown[] = []

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    assert.isTrue(result.length >= 2)
    const names = result.map((t: any) => t.name)
    assert.include(names, 'Tags Test Action')
    assert.include(names, 'Tags Test Comedy')

    // Verify shape includes mediaCount
    const tag = result.find((t: any) => t.name === 'Tags Test Action') as Record<string, unknown>
    assert.property(tag, 'mediaCount')
    assert.equal(tag.mediaCount, 0)
  })

  // ---- store ----

  test('store creates a new tag', async ({ assert }) => {
    const controller = new TagsController()
    let result: Record<string, unknown> = {}
    let statusCode = 0

    await controller.store({
      request: {
        validateUsing: async () => ({ name: 'Tags Test Drama' }),
      },
      response: {
        created(data: unknown) {
          statusCode = 201
          result = data as Record<string, unknown>
        },
        conflict() {},
      },
    } as never)

    assert.equal(statusCode, 201)
    assert.equal(result.name, 'Tags Test Drama')
    assert.isNotNull(result.id)

    // Cleanup
    if (result.id) {
      await Tag.query().where('id', result.id as string).delete()
    }
  })

  test('store returns conflict for duplicate tag name', async ({ assert }) => {
    const controller = new TagsController()
    let conflictResult: Record<string, unknown> = {}

    await controller.store({
      request: {
        validateUsing: async () => ({ name: 'Tags Test Action' }),
      },
      response: {
        created() {},
        conflict(data: unknown) {
          conflictResult = data as Record<string, unknown>
        },
      },
    } as never)

    const error = conflictResult.error as Record<string, string>
    assert.equal(error.code, 'DUPLICATE')
  })

  // ---- show ----

  test('show returns tag with media groups', async ({ assert }) => {
    const controller = new TagsController()
    let result: Record<string, unknown> = {}

    await controller.show({
      params: { id: tag1.id },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.name, 'Tags Test Action')
    assert.property(result, 'media')
  })

  test('show returns notFound for non-existent tag', async ({ assert }) => {
    const controller = new TagsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.show({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    const error = notFoundResult.error as Record<string, string>
    assert.equal(error.code, 'NOT_FOUND')
  })

  // ---- update ----

  test('update modifies tag name', async ({ assert }) => {
    const tagToUpdate = await Tag.create({ name: 'Tags Test Old Name' })

    const controller = new TagsController()
    let result: Record<string, unknown> = {}

    await controller.update({
      params: { id: tagToUpdate.id },
      request: {
        validateUsing: async () => ({ name: 'Tags Test New Name' }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
        conflict() {},
      },
    } as never)

    assert.equal(result.name, 'Tags Test New Name')

    // Verify in database
    await tagToUpdate.refresh()
    assert.equal(tagToUpdate.name, 'Tags Test New Name')

    await tagToUpdate.delete()
  })

  test('update returns notFound for non-existent tag', async ({ assert }) => {
    const controller = new TagsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.update({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: {
        validateUsing: async () => ({ name: 'Whatever' }),
      },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        conflict() {},
      },
    } as never)

    const error = notFoundResult.error as Record<string, string>
    assert.equal(error.code, 'NOT_FOUND')
  })

  test('update returns conflict when name already taken by another tag', async ({ assert }) => {
    const controller = new TagsController()
    let conflictResult: Record<string, unknown> = {}

    await controller.update({
      params: { id: tag2.id },
      request: {
        validateUsing: async () => ({ name: 'Tags Test Action' }),
      },
      response: {
        json() {},
        notFound() {},
        conflict(data: unknown) {
          conflictResult = data as Record<string, unknown>
        },
      },
    } as never)

    const error = conflictResult.error as Record<string, string>
    assert.equal(error.code, 'DUPLICATE')
  })

  // ---- destroy ----

  test('destroy deletes a tag', async ({ assert }) => {
    const toDelete = await Tag.create({ name: 'Tags Test Delete Me' })

    const controller = new TagsController()
    let noContentCalled = false

    await controller.destroy({
      params: { id: toDelete.id },
      response: {
        noContent() {
          noContentCalled = true
        },
        notFound() {},
      },
    } as never)

    assert.isTrue(noContentCalled)

    const deleted = await Tag.find(toDelete.id)
    assert.isNull(deleted)
  })

  test('destroy returns notFound for non-existent tag', async ({ assert }) => {
    const controller = new TagsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.destroy({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        noContent() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    const error = notFoundResult.error as Record<string, string>
    assert.equal(error.code, 'NOT_FOUND')
  })

  // ---- assign ----

  test('assign creates tag-media association', async ({ assert }) => {
    const mediaId = randomUUID()
    const controller = new TagsController()
    let result: Record<string, unknown> = {}

    await controller.assign({
      params: { id: tag1.id },
      request: {
        validateUsing: async () => ({
          mediaType: 'movie' as const,
          mediaId,
        }),
      },
      response: {
        created(data: unknown) {
          result = data as Record<string, unknown>
        },
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.isNotNull(result.id)
    assert.equal(result.tagId, tag1.id)
    assert.equal(result.mediaType, 'movie')
    assert.equal(result.mediaId, mediaId)

    // Cleanup
    await MediaTag.query().where('tagId', tag1.id).where('mediaId', mediaId).delete()
  })

  test('assign returns existing association if already assigned', async ({ assert }) => {
    const mediaId = randomUUID()
    // Pre-create the association
    await MediaTag.create({
      tagId: tag1.id,
      mediaType: 'movie',
      mediaId,
    })

    const controller = new TagsController()
    let result: Record<string, unknown> = {}

    await controller.assign({
      params: { id: tag1.id },
      request: {
        validateUsing: async () => ({
          mediaType: 'movie' as const,
          mediaId,
        }),
      },
      response: {
        created() {},
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.tagId, tag1.id)
    assert.equal(result.mediaId, mediaId)

    // Cleanup
    await MediaTag.query().where('tagId', tag1.id).where('mediaId', mediaId).delete()
  })

  test('assign returns notFound for non-existent tag', async ({ assert }) => {
    const controller = new TagsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.assign({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: {
        validateUsing: async () => ({
          mediaType: 'movie' as const,
          mediaId: randomUUID(),
        }),
      },
      response: {
        created() {},
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    const error = notFoundResult.error as Record<string, string>
    assert.equal(error.code, 'NOT_FOUND')
  })

  // ---- unassign ----

  test('unassign removes tag-media association', async ({ assert }) => {
    const mediaId = randomUUID()
    await MediaTag.create({
      tagId: tag1.id,
      mediaType: 'movie',
      mediaId,
    })

    const controller = new TagsController()
    let noContentCalled = false

    await controller.unassign({
      params: { id: tag1.id },
      request: {
        validateUsing: async () => ({
          mediaType: 'movie' as const,
          mediaId,
        }),
      },
      response: {
        noContent() {
          noContentCalled = true
        },
        notFound() {},
      },
    } as never)

    assert.isTrue(noContentCalled)

    const deleted = await MediaTag.query()
      .where('tagId', tag1.id)
      .where('mediaId', mediaId)
      .first()
    assert.isNull(deleted)
  })

  test('unassign returns notFound when assignment does not exist', async ({ assert }) => {
    const controller = new TagsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.unassign({
      params: { id: tag1.id },
      request: {
        validateUsing: async () => ({
          mediaType: 'movie' as const,
          mediaId: randomUUID(),
        }),
      },
      response: {
        noContent() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    const error = notFoundResult.error as Record<string, string>
    assert.equal(error.code, 'NOT_FOUND')
  })

  // ---- bulkAssign ----

  test('bulkAssign assigns tag to multiple media items', async ({ assert }) => {
    const mediaIds = [randomUUID(), randomUUID(), randomUUID()]

    const controller = new TagsController()
    let result: Record<string, unknown> = {}

    await controller.bulkAssign({
      params: { id: tag2.id },
      request: {
        validateUsing: async () => ({
          mediaType: 'tvshow' as const,
          mediaIds,
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.assigned, 3)
    assert.equal(result.skipped, 0)

    // Cleanup
    await MediaTag.query().where('tagId', tag2.id).whereIn('mediaId', mediaIds).delete()
  })

  test('bulkAssign skips already assigned media', async ({ assert }) => {
    const existingId = randomUUID()
    const newId = randomUUID()

    await MediaTag.create({
      tagId: tag2.id,
      mediaType: 'tvshow',
      mediaId: existingId,
    })

    const controller = new TagsController()
    let result: Record<string, unknown> = {}

    await controller.bulkAssign({
      params: { id: tag2.id },
      request: {
        validateUsing: async () => ({
          mediaType: 'tvshow' as const,
          mediaIds: [existingId, newId],
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.assigned, 1)
    assert.equal(result.skipped, 1)

    // Cleanup
    await MediaTag.query()
      .where('tagId', tag2.id)
      .whereIn('mediaId', [existingId, newId])
      .delete()
  })

  // ---- media ----

  test('media returns media items for a tag', async ({ assert }) => {
    const mediaId = randomUUID()
    await MediaTag.create({
      tagId: tag1.id,
      mediaType: 'artist',
      mediaId,
    })

    const controller = new TagsController()
    let result: unknown[] = []

    await controller.media({
      params: { id: tag1.id },
      request: {
        input: () => undefined,
      },
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
        notFound() {},
      },
    } as never)

    assert.isTrue(result.length >= 1)

    // Cleanup
    await MediaTag.query().where('tagId', tag1.id).where('mediaId', mediaId).delete()
  })

  test('media filters by mediaType', async ({ assert }) => {
    const movieId = randomUUID()
    const artistId = randomUUID()
    await MediaTag.create({ tagId: tag1.id, mediaType: 'movie', mediaId: movieId })
    await MediaTag.create({ tagId: tag1.id, mediaType: 'artist', mediaId: artistId })

    const controller = new TagsController()
    let result: unknown[] = []

    await controller.media({
      params: { id: tag1.id },
      request: {
        input: (key: string) => (key === 'mediaType' ? 'movie' : undefined),
      },
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
        notFound() {},
      },
    } as never)

    for (const mt of result as any[]) {
      assert.equal(mt.mediaType, 'movie')
    }

    // Cleanup
    await MediaTag.query()
      .where('tagId', tag1.id)
      .whereIn('mediaId', [movieId, artistId])
      .delete()
  })

  // ---- forMedia ----

  test('forMedia returns tags for a specific media item', async ({ assert }) => {
    const mediaId = randomUUID()
    await MediaTag.create({ tagId: tag1.id, mediaType: 'movie', mediaId })
    await MediaTag.create({ tagId: tag2.id, mediaType: 'movie', mediaId })

    const controller = new TagsController()
    let result: unknown[] = []

    await controller.forMedia({
      request: {
        input: (key: string) => {
          if (key === 'mediaType') return 'movie'
          if (key === 'mediaId') return mediaId
          return undefined
        },
      },
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
        badRequest() {},
      },
    } as never)

    assert.equal(result.length, 2)
    const names = result.map((t: any) => t.name)
    assert.include(names, 'Tags Test Action')
    assert.include(names, 'Tags Test Comedy')

    // Cleanup
    await MediaTag.query().where('mediaId', mediaId).delete()
  })

  test('forMedia returns badRequest when mediaType or mediaId missing', async ({ assert }) => {
    const controller = new TagsController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.forMedia({
      request: {
        input: () => undefined,
      },
      response: {
        json() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    const error = badRequestResult.error as Record<string, string>
    assert.equal(error.code, 'VALIDATION_ERROR')
  })
})
