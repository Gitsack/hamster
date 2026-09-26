import { test } from '@japa/runner'
import type QualityProfile from '#models/quality_profile'
import { assessFile } from '#services/quality/file_quality_service'

test.group('file_quality_service | assessFile original language', () => {
  const profile = {
    name: '1080p',
    cutoff: 5,
    items: [{ id: 5, name: 'Web 1080p', allowed: true }],
    requirements: { requiredAudioLanguages: ['original'] },
  } as unknown as QualityProfile

  const englishFile = { width: 1920, height: 1080, audioLanguages: ['en'] }

  test('accepts a file in the title’s original language', ({ assert }) => {
    const assessment = assessFile(englishFile, 'Web 1080p', profile, 'tv', 'en')
    assert.isEmpty(assessment.issues)
    assert.isTrue(assessment.meetsProfile)
  })

  test('flags a file that is not in the original language', ({ assert }) => {
    const assessment = assessFile(englishFile, 'Web 1080p', profile, 'tv', 'ja')
    assert.lengthOf(assessment.issues, 1)
    assert.equal(assessment.issues[0].code, 'audio-language')
  })

  test('drops the rule when the original language is unknown', ({ assert }) => {
    const assessment = assessFile(englishFile, 'Web 1080p', profile, 'tv', null)
    assert.isEmpty(assessment.issues)
  })
})
