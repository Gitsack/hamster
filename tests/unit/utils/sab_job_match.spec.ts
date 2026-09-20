import { test } from '@japa/runner'
import { isSameJob, normalizeJobName } from '#utils/sab_job_match'

test.group('sab_job_match | normalizeJobName', () => {
  test('drops the nzb extension', ({ assert }) => {
    assert.equal(
      normalizeJobName('Hancock.2008.2160p.BluRay.x265-MainFrame.nzb'),
      'hancock 2008 2160p bluray x265 mainframe'
    )
  })

  test('drops the copy suffix SABnzbd adds to a job it already holds', ({ assert }) => {
    assert.equal(
      normalizeJobName('Hancock.2008.2160p.BluRay.x265-MainFrame.1'),
      'hancock 2008 2160p bluray x265 mainframe'
    )
  })

  test('treats dots, underscores and spaces as the same separator', ({ assert }) => {
    assert.equal(
      normalizeJobName('Love_Rosie_2014_1080p_WEB-DL'),
      normalizeJobName('Love Rosie 2014 1080p WEB DL')
    )
  })

  test('drops punctuation a client may strip on its own', ({ assert }) => {
    assert.equal(
      normalizeJobName('Crazy Rich Asians [2018] (4KLight)'),
      'crazy rich asians 2018 4klight'
    )
  })
})

test.group('sab_job_match | isSameJob', () => {
  test('matches the name SABnzbd reports back to the title we sent', ({ assert }) => {
    assert.isTrue(
      isSameJob(
        'The Holiday 2006 2160p AMZN WEB-DL DTS-HD MA 5 1 H 265-FLUX',
        'The.Holiday.2006.2160p.AMZN.WEB-DL.DTS-HD.MA.5.1.H.265-FLUX'
      )
    )
  })

  test('matches a second copy of the same job', ({ assert }) => {
    assert.isTrue(
      isSameJob(
        'Hancock.2008.2160p.BluRay.TrueHD.Atmos.7.1.DV.HDR10.x265-MainFrame.2',
        'Hancock.2008.2160p.BluRay.TrueHD.Atmos.7.1.DV.HDR10.x265-MainFrame'
      )
    )
  })

  test('does not match a different release of the same title', ({ assert }) => {
    assert.isFalse(
      isSameJob(
        'The Holiday 2006 1080p BluRay x264-AMIABLE',
        'The.Holiday.2006.2160p.AMZN.WEB-DL.DTS-HD.MA.5.1.H.265-FLUX'
      )
    )
  })

  test('does not match on an empty name', ({ assert }) => {
    assert.isFalse(isSameJob('', 'The.Holiday.2006.2160p.AMZN.WEB-DL'))
  })
})
