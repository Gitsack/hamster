import { test } from '@japa/runner'
import QualityProfile from '#models/quality_profile'
import Artist from '#models/artist'
import QualityProfilesController from '#controllers/quality_profiles_controller'
import { ArtistFactory } from '../../../database/factories/artist_factory.js'

const sampleItems = [
  { id: 1, name: 'FLAC', allowed: true },
  { id: 2, name: 'MP3-320', allowed: true },
  { id: 3, name: 'MP3-256', allowed: false },
]

test.group('QualityProfilesController', (group) => {
  let profile1: QualityProfile
  let profile2: QualityProfile

  group.setup(async () => {
    profile1 = await QualityProfile.create({
      name: 'QP Test High Quality',
      cutoff: 1,
      upgradeAllowed: true,
      items: sampleItems,
    })
    profile2 = await QualityProfile.create({
      name: 'QP Test Standard',
      cutoff: 2,
      upgradeAllowed: false,
      items: sampleItems,
    })
  })

  group.teardown(async () => {
    // Clean up artists that reference these profiles first
    await Artist.query().whereIn('qualityProfileId', [profile1.id, profile2.id]).delete()
    await QualityProfile.query().whereIn('id', [profile1.id, profile2.id]).delete()
    await QualityProfile.query().where('name', 'like', 'QP Test%').delete()
  })

  // ---- index ----

  test('index returns list of quality profiles', async ({ assert }) => {
    const controller = new QualityProfilesController()
    let result: unknown[] = []

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    assert.isTrue(result.length >= 2)
    const names = result.map((p: any) => p.name)
    assert.include(names, 'QP Test High Quality')
    assert.include(names, 'QP Test Standard')
  })

  // ---- store ----

  test('store creates a new quality profile', async ({ assert }) => {
    const controller = new QualityProfilesController()
    let result: Record<string, unknown> = {}
    let statusCode = 0

    await controller.store({
      request: {
        validateUsing: async () => ({
          name: 'QP Test Custom',
          cutoff: 1,
          upgradeAllowed: true,
          items: [
            { id: 1, name: 'Bluray-1080p', allowed: true },
            { id: 2, name: 'HDTV-720p', allowed: false },
          ],
        }),
      },
      response: {
        created(data: unknown) {
          statusCode = 201
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(statusCode, 201)
    assert.equal(result.name, 'QP Test Custom')
    assert.equal(result.cutoff, 1)
    assert.equal(result.upgradeAllowed, true)

    // Verify in database
    const created = await QualityProfile.find(result.id as string)
    assert.isNotNull(created)
    assert.equal(created!.name, 'QP Test Custom')

    // Cleanup
    await created?.delete()
  })

  test('store creates profile with optional mediaType', async ({ assert }) => {
    const controller = new QualityProfilesController()
    let result: Record<string, unknown> = {}

    await controller.store({
      request: {
        validateUsing: async () => ({
          name: 'QP Test Movie Profile',
          mediaType: 'movies',
          cutoff: 1,
          items: sampleItems,
        }),
      },
      response: {
        created(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(result.name, 'QP Test Movie Profile')
    assert.equal(result.mediaType, 'movies')

    // Cleanup
    if (result.id) {
      await QualityProfile.query().where('id', result.id as string).delete()
    }
  })

  // ---- show ----

  test('show returns quality profile details', async ({ assert }) => {
    const controller = new QualityProfilesController()
    let result: Record<string, unknown> = {}

    await controller.show({
      params: { id: profile1.id },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.id, profile1.id)
    assert.equal(result.name, 'QP Test High Quality')
    assert.equal(result.cutoff, 1)
    assert.equal(result.upgradeAllowed, true)
    assert.isArray(result.items)
  })

  test('show returns notFound for non-existent profile', async ({ assert }) => {
    const controller = new QualityProfilesController()
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

    assert.equal(notFoundResult.error, 'Quality profile not found')
  })

  // ---- update ----

  test('update modifies quality profile', async ({ assert }) => {
    const controller = new QualityProfilesController()
    let result: Record<string, unknown> = {}

    const updatedItems = [
      { id: 1, name: 'FLAC', allowed: true },
      { id: 2, name: 'MP3-320', allowed: false },
    ]

    await controller.update({
      params: { id: profile2.id },
      request: {
        validateUsing: async () => ({
          name: 'QP Test Standard Updated',
          cutoff: 1,
          upgradeAllowed: true,
          items: updatedItems,
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.name, 'QP Test Standard Updated')
    assert.equal(result.cutoff, 1)
    assert.equal(result.upgradeAllowed, true)

    // Verify in database
    await profile2.refresh()
    assert.equal(profile2.name, 'QP Test Standard Updated')

    // Reset for other tests
    profile2.name = 'QP Test Standard'
    profile2.cutoff = 2
    profile2.upgradeAllowed = false
    profile2.items = sampleItems
    await profile2.save()
  })

  test('update returns notFound for non-existent profile', async ({ assert }) => {
    const controller = new QualityProfilesController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.update({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: {
        validateUsing: async () => ({
          name: 'Whatever',
          cutoff: 1,
          items: sampleItems,
        }),
      },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(notFoundResult.error, 'Quality profile not found')
  })

  // ---- destroy ----

  test('destroy deletes a quality profile', async ({ assert }) => {
    const toDelete = await QualityProfile.create({
      name: 'QP Test Delete Me',
      cutoff: 1,
      upgradeAllowed: true,
      items: sampleItems,
    })

    const controller = new QualityProfilesController()
    let noContentCalled = false

    await controller.destroy({
      params: { id: toDelete.id },
      response: {
        noContent() {
          noContentCalled = true
        },
        notFound() {},
        conflict() {},
      },
    } as never)

    assert.isTrue(noContentCalled)

    const deleted = await QualityProfile.find(toDelete.id)
    assert.isNull(deleted)
  })

  test('destroy returns notFound for non-existent profile', async ({ assert }) => {
    const controller = new QualityProfilesController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.destroy({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        noContent() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        conflict() {},
      },
    } as never)

    assert.equal(notFoundResult.error, 'Quality profile not found')
  })

  test('destroy returns conflict when profile is in use', async ({ assert }) => {
    const profileInUse = await QualityProfile.create({
      name: 'QP Test In Use',
      cutoff: 1,
      upgradeAllowed: true,
      items: sampleItems,
    })

    // Create an artist that uses this profile
    const artist = await ArtistFactory.create({
      name: 'QP Test Artist',
    })
    artist.qualityProfileId = profileInUse.id
    await artist.save()

    const controller = new QualityProfilesController()
    let conflictResult: Record<string, unknown> = {}

    await controller.destroy({
      params: { id: profileInUse.id },
      response: {
        noContent() {},
        notFound() {},
        conflict(data: unknown) {
          conflictResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.include(conflictResult.error as string, 'in use')

    // Verify profile still exists
    const stillExists = await QualityProfile.find(profileInUse.id)
    assert.isNotNull(stillExists)

    // Cleanup
    await artist.delete()
    await profileInUse.delete()
  })
})
