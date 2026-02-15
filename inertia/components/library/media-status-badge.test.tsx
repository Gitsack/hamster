import { getMediaItemStatus } from './media-status-badge'

describe('getMediaItemStatus', () => {
  describe('downloaded status', () => {
    it('returns downloaded when item has file', () => {
      const result = getMediaItemStatus({ hasFile: true })
      expect(result).toEqual({ status: 'downloaded', progress: 100 })
    })

    it('returns downloaded even when also requested', () => {
      const result = getMediaItemStatus({ hasFile: true, requested: true })
      expect(result).toEqual({ status: 'downloaded', progress: 100 })
    })

    it('returns downloaded even with active download', () => {
      const result = getMediaItemStatus(
        { hasFile: true },
        { progress: 50, status: 'downloading' }
      )
      expect(result).toEqual({ status: 'downloaded', progress: 100 })
    })
  })

  describe('downloading status', () => {
    it('returns downloading with progress when active download exists', () => {
      const result = getMediaItemStatus(
        { hasFile: false },
        { progress: 45, status: 'downloading' }
      )
      expect(result).toEqual({ status: 'downloading', progress: 45 })
    })

    it('returns downloading with zero progress', () => {
      const result = getMediaItemStatus({}, { progress: 0, status: 'downloading' })
      expect(result).toEqual({ status: 'downloading', progress: 0 })
    })

    it('returns downloading with 100% progress', () => {
      const result = getMediaItemStatus({}, { progress: 100, status: 'downloading' })
      expect(result).toEqual({ status: 'downloading', progress: 100 })
    })
  })

  describe('importing status', () => {
    it('returns importing when active download has importing status', () => {
      const result = getMediaItemStatus(
        { hasFile: false },
        { progress: 100, status: 'importing' }
      )
      expect(result).toEqual({ status: 'importing', progress: 100 })
    })

    it('returns importing regardless of download progress value', () => {
      const result = getMediaItemStatus({}, { progress: 50, status: 'importing' })
      expect(result).toEqual({ status: 'importing', progress: 100 })
    })
  })

  describe('requested status', () => {
    it('returns requested when item is requested but no file or download', () => {
      const result = getMediaItemStatus({ requested: true })
      expect(result).toEqual({ status: 'requested', progress: 0 })
    })

    it('returns requested when hasFile is false and requested is true', () => {
      const result = getMediaItemStatus({ hasFile: false, requested: true })
      expect(result).toEqual({ status: 'requested', progress: 0 })
    })

    it('returns requested with null active download', () => {
      const result = getMediaItemStatus({ requested: true }, null)
      expect(result).toEqual({ status: 'requested', progress: 0 })
    })
  })

  describe('none status', () => {
    it('returns none when no properties are set', () => {
      const result = getMediaItemStatus({})
      expect(result).toEqual({ status: 'none', progress: 0 })
    })

    it('returns none when all properties are false/undefined', () => {
      const result = getMediaItemStatus({ hasFile: false, requested: false })
      expect(result).toEqual({ status: 'none', progress: 0 })
    })

    it('returns none with no active download', () => {
      const result = getMediaItemStatus({}, null)
      expect(result).toEqual({ status: 'none', progress: 0 })
    })

    it('returns none with undefined active download', () => {
      const result = getMediaItemStatus({}, undefined)
      expect(result).toEqual({ status: 'none', progress: 0 })
    })
  })

  describe('priority ordering', () => {
    it('hasFile takes priority over activeDownload', () => {
      const result = getMediaItemStatus(
        { hasFile: true, requested: true },
        { progress: 50, status: 'downloading' }
      )
      expect(result.status).toBe('downloaded')
    })

    it('activeDownload takes priority over requested', () => {
      const result = getMediaItemStatus(
        { hasFile: false, requested: true },
        { progress: 30, status: 'downloading' }
      )
      expect(result.status).toBe('downloading')
    })

    it('importing download takes priority over requested', () => {
      const result = getMediaItemStatus(
        { requested: true },
        { progress: 100, status: 'importing' }
      )
      expect(result.status).toBe('importing')
    })
  })
})
