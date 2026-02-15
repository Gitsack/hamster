import { test } from '@japa/runner'
import RenameController from '#controllers/rename_controller'
import { fileOrganizerService } from '#services/media/file_organizer_service'

test.group('RenameController', () => {
  // ---- renameMovie ----

  test('renameMovie in preview mode returns preview items', async ({ assert }) => {
    const controller = new RenameController()
    let result: Record<string, unknown> = {}

    const originalMethod = fileOrganizerService.previewRenameMovie
    fileOrganizerService.previewRenameMovie = async () => [
      { existingPath: '/movies/old.mkv', newPath: '/movies/new.mkv', willRename: true },
    ]

    try {
      await controller.renameMovie({
        params: { id: 'fake-movie-id' },
        request: {
          input: (key: string) => (key === 'preview' ? 'true' : undefined),
        },
        response: {
          json(data: unknown) {
            result = data as Record<string, unknown>
          },
        },
      } as never)

      assert.isTrue(result.preview as boolean)
      assert.isArray(result.items)
      const items = result.items as Array<Record<string, unknown>>
      assert.equal(items.length, 1)
      assert.equal(items[0].existingPath, '/movies/old.mkv')
      assert.equal(items[0].newPath, '/movies/new.mkv')
    } finally {
      fileOrganizerService.previewRenameMovie = originalMethod
    }
  })

  test('renameMovie in execute mode returns moved count and errors', async ({ assert }) => {
    const controller = new RenameController()
    let result: Record<string, unknown> = {}

    const originalMethod = fileOrganizerService.renameMovie
    fileOrganizerService.renameMovie = async () => ({ moved: 2, errors: [] })

    try {
      await controller.renameMovie({
        params: { id: 'fake-movie-id' },
        request: {
          input: () => undefined,
        },
        response: {
          json(data: unknown) {
            result = data as Record<string, unknown>
          },
        },
      } as never)

      assert.isFalse(result.preview as boolean)
      assert.equal(result.moved, 2)
      assert.isArray(result.errors)
      assert.equal((result.errors as string[]).length, 0)
    } finally {
      fileOrganizerService.renameMovie = originalMethod
    }
  })

  test('renameMovie in execute mode reports errors', async ({ assert }) => {
    const controller = new RenameController()
    let result: Record<string, unknown> = {}

    const originalMethod = fileOrganizerService.renameMovie
    fileOrganizerService.renameMovie = async () => ({
      moved: 0,
      errors: ['Failed to move file.mkv'],
    })

    try {
      await controller.renameMovie({
        params: { id: 'fake-movie-id' },
        request: {
          input: () => undefined,
        },
        response: {
          json(data: unknown) {
            result = data as Record<string, unknown>
          },
        },
      } as never)

      assert.isFalse(result.preview as boolean)
      assert.equal(result.moved, 0)
      assert.equal((result.errors as string[]).length, 1)
    } finally {
      fileOrganizerService.renameMovie = originalMethod
    }
  })

  // ---- renameTvShow ----

  test('renameTvShow in preview mode returns preview items', async ({ assert }) => {
    const controller = new RenameController()
    let result: Record<string, unknown> = {}

    const originalMethod = fileOrganizerService.previewRenameEpisodes
    fileOrganizerService.previewRenameEpisodes = async () => [
      { existingPath: '/tv/old.mkv', newPath: '/tv/new.mkv', willRename: true },
      { existingPath: '/tv/old2.mkv', newPath: '/tv/new2.mkv', willRename: false },
    ]

    try {
      await controller.renameTvShow({
        params: { id: 'fake-tvshow-id' },
        request: {
          input: (key: string) => (key === 'preview' ? 'true' : undefined),
        },
        response: {
          json(data: unknown) {
            result = data as Record<string, unknown>
          },
        },
      } as never)

      assert.isTrue(result.preview as boolean)
      assert.isArray(result.items)
      assert.equal((result.items as unknown[]).length, 2)
    } finally {
      fileOrganizerService.previewRenameEpisodes = originalMethod
    }
  })

  test('renameTvShow in execute mode returns moved count and errors', async ({ assert }) => {
    const controller = new RenameController()
    let result: Record<string, unknown> = {}

    const originalMethod = fileOrganizerService.renameEpisodes
    fileOrganizerService.renameEpisodes = async () => ({ moved: 5, errors: [] })

    try {
      await controller.renameTvShow({
        params: { id: 'fake-tvshow-id' },
        request: {
          input: () => undefined,
        },
        response: {
          json(data: unknown) {
            result = data as Record<string, unknown>
          },
        },
      } as never)

      assert.isFalse(result.preview as boolean)
      assert.equal(result.moved, 5)
      assert.isArray(result.errors)
    } finally {
      fileOrganizerService.renameEpisodes = originalMethod
    }
  })

  // ---- renameArtist ----

  test('renameArtist in preview mode returns preview items', async ({ assert }) => {
    const controller = new RenameController()
    let result: Record<string, unknown> = {}

    const originalMethod = fileOrganizerService.previewRenameArtist
    fileOrganizerService.previewRenameArtist = async () => [
      { existingPath: '/music/old.flac', newPath: '/music/new.flac', willRename: true },
    ]

    try {
      await controller.renameArtist({
        params: { id: 'fake-artist-id' },
        request: {
          input: (key: string) => (key === 'preview' ? 'true' : undefined),
        },
        response: {
          json(data: unknown) {
            result = data as Record<string, unknown>
          },
        },
      } as never)

      assert.isTrue(result.preview as boolean)
      assert.isArray(result.items)
      assert.equal((result.items as unknown[]).length, 1)
    } finally {
      fileOrganizerService.previewRenameArtist = originalMethod
    }
  })

  test('renameArtist in execute mode returns moved count and errors', async ({ assert }) => {
    const controller = new RenameController()
    let result: Record<string, unknown> = {}

    const originalMethod = fileOrganizerService.renameArtist
    fileOrganizerService.renameArtist = async () => ({ moved: 3, errors: [] })

    try {
      await controller.renameArtist({
        params: { id: 'fake-artist-id' },
        request: {
          input: () => undefined,
        },
        response: {
          json(data: unknown) {
            result = data as Record<string, unknown>
          },
        },
      } as never)

      assert.isFalse(result.preview as boolean)
      assert.equal(result.moved, 3)
      assert.isArray(result.errors)
    } finally {
      fileOrganizerService.renameArtist = originalMethod
    }
  })

  // ---- renameAuthor ----

  test('renameAuthor in preview mode returns preview items', async ({ assert }) => {
    const controller = new RenameController()
    let result: Record<string, unknown> = {}

    const originalMethod = fileOrganizerService.previewRenameBooks
    fileOrganizerService.previewRenameBooks = async () => [
      { existingPath: '/books/old.epub', newPath: '/books/new.epub', willRename: true },
    ]

    try {
      await controller.renameAuthor({
        params: { id: 'fake-author-id' },
        request: {
          input: (key: string) => (key === 'preview' ? 'true' : undefined),
        },
        response: {
          json(data: unknown) {
            result = data as Record<string, unknown>
          },
        },
      } as never)

      assert.isTrue(result.preview as boolean)
      assert.isArray(result.items)
      assert.equal((result.items as unknown[]).length, 1)
    } finally {
      fileOrganizerService.previewRenameBooks = originalMethod
    }
  })

  test('renameAuthor in execute mode returns moved count and errors', async ({ assert }) => {
    const controller = new RenameController()
    let result: Record<string, unknown> = {}

    const originalMethod = fileOrganizerService.renameBooks
    fileOrganizerService.renameBooks = async () => ({ moved: 1, errors: [] })

    try {
      await controller.renameAuthor({
        params: { id: 'fake-author-id' },
        request: {
          input: () => undefined,
        },
        response: {
          json(data: unknown) {
            result = data as Record<string, unknown>
          },
        },
      } as never)

      assert.isFalse(result.preview as boolean)
      assert.equal(result.moved, 1)
      assert.isArray(result.errors)
    } finally {
      fileOrganizerService.renameBooks = originalMethod
    }
  })

  test('renameAuthor in execute mode with errors', async ({ assert }) => {
    const controller = new RenameController()
    let result: Record<string, unknown> = {}

    const originalMethod = fileOrganizerService.renameBooks
    fileOrganizerService.renameBooks = async () => ({
      moved: 0,
      errors: ['Permission denied: /books/old.epub'],
    })

    try {
      await controller.renameAuthor({
        params: { id: 'fake-author-id' },
        request: {
          input: () => undefined,
        },
        response: {
          json(data: unknown) {
            result = data as Record<string, unknown>
          },
        },
      } as never)

      assert.isFalse(result.preview as boolean)
      assert.equal(result.moved, 0)
      assert.equal((result.errors as string[]).length, 1)
      assert.include(result.errors as string[], 'Permission denied: /books/old.epub')
    } finally {
      fileOrganizerService.renameBooks = originalMethod
    }
  })
})
