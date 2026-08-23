import { test } from '@japa/runner'

/**
 * Tests for the pure functions in BlacklistService.
 * We instantiate the class directly and test shouldBlacklist/determineFailureType
 * which are pure functions that do not require DB access.
 */

// The BlacklistService class is exported, but we need to test through the singleton
// since shouldBlacklist and determineFailureType are instance methods.
// We import the singleton for convenience.
import { blacklistService } from '../../../app/services/blacklist/blacklist_service.js'

test.group('BlacklistService | shouldBlacklist', () => {
  // Blacklistable error messages
  test('returns true for "download failed"', ({ assert }) => {
    assert.isTrue(blacklistService.shouldBlacklist('Download Failed'))
  })

  test('returns true for "extraction failed"', ({ assert }) => {
    assert.isTrue(blacklistService.shouldBlacklist('Extraction Failed: CRC error'))
  })

  test('returns true for "unpack failed"', ({ assert }) => {
    assert.isTrue(blacklistService.shouldBlacklist('Unpack failed for release'))
  })

  test('returns true for "crc error"', ({ assert }) => {
    assert.isTrue(blacklistService.shouldBlacklist('CRC Error detected in file'))
  })

  test('returns true for "par2 failed"', ({ assert }) => {
    assert.isTrue(blacklistService.shouldBlacklist('PAR2 failed to repair'))
  })

  test('returns true for "verification failed"', ({ assert }) => {
    assert.isTrue(blacklistService.shouldBlacklist('Verification failed'))
  })

  test('returns true for "missing articles"', ({ assert }) => {
    assert.isTrue(blacklistService.shouldBlacklist('Missing articles for download'))
  })

  test('returns true for "incomplete"', ({ assert }) => {
    assert.isTrue(blacklistService.shouldBlacklist('Download incomplete'))
  })

  test('returns true for "password protected"', ({ assert }) => {
    assert.isTrue(blacklistService.shouldBlacklist('Archive is password protected'))
  })

  test('returns true for "encrypted"', ({ assert }) => {
    assert.isTrue(blacklistService.shouldBlacklist('File is encrypted'))
  })

  test('returns true for "corrupt"', ({ assert }) => {
    assert.isTrue(blacklistService.shouldBlacklist('File is corrupt'))
  })

  test('returns true for "out of retention"', ({ assert }) => {
    assert.isTrue(blacklistService.shouldBlacklist('Out of retention'))
  })

  // Non-blacklistable error messages (config/infrastructure issues)
  test('returns false for "path not accessible"', ({ assert }) => {
    assert.isFalse(blacklistService.shouldBlacklist('Path not accessible'))
  })

  test('returns false for "not mounted"', ({ assert }) => {
    assert.isFalse(blacklistService.shouldBlacklist('Drive not mounted'))
  })

  test('returns false for "permission denied"', ({ assert }) => {
    assert.isFalse(blacklistService.shouldBlacklist('Permission denied for /media'))
  })

  test('returns false for "disk full"', ({ assert }) => {
    assert.isFalse(blacklistService.shouldBlacklist('Disk full'))
  })

  test('returns false for "no space"', ({ assert }) => {
    assert.isFalse(blacklistService.shouldBlacklist('No space left on device'))
  })

  test('returns false for "remote path mapping"', ({ assert }) => {
    assert.isFalse(blacklistService.shouldBlacklist('Remote path mapping error'))
  })

  test('returns false for transient network errors', ({ assert }) => {
    assert.isFalse(blacklistService.shouldBlacklist('The operation timed out.'))
    assert.isFalse(blacklistService.shouldBlacklist('Connection refused'))
    assert.isFalse(blacklistService.shouldBlacklist('Could not resolve host: nzbfinder.ws'))
  })

  // Blacklistable failures seen in the wild
  test('returns true for "URL Fetching failed; Maximum retries"', ({ assert }) => {
    assert.isTrue(blacklistService.shouldBlacklist('URL Fetching failed; Maximum retries'))
  })

  test('returns true for an import that found nothing usable', ({ assert }) => {
    assert.isTrue(blacklistService.shouldBlacklist('No video files found in download'))
    assert.isTrue(blacklistService.shouldBlacklist('No audio files found in download'))
  })

  test('returns false when the client simply never unpacked the download', ({ assert }) => {
    // A complete, valid release whose archives the client failed to extract.
    // Blacklisting it would discard a good download and grab a needless replacement.
    assert.isFalse(
      blacklistService.shouldBlacklist(
        'Download not unpacked - archives present but no media files. Waiting for the download client to extract.'
      )
    )
  })

  // Edge cases
  test('defaults to blacklisting unknown errors', ({ assert }) => {
    // shouldBlacklist is only consulted for a slot the client already reported
    // as Failed, so an unrecognised message still means this release is bad.
    assert.isTrue(blacklistService.shouldBlacklist('Some completely unknown error'))
  })

  test('is case-insensitive', ({ assert }) => {
    assert.isTrue(blacklistService.shouldBlacklist('DOWNLOAD FAILED'))
  })

  test('non-blacklistable takes priority over blacklistable', ({ assert }) => {
    // "path not accessible" + "failed" - the non-blacklistable pattern should win
    assert.isFalse(blacklistService.shouldBlacklist('path not accessible - failed'))
  })
})

test.group('BlacklistService | determineFailureType', () => {
  test('returns extraction_failed for "extraction" errors', ({ assert }) => {
    assert.equal(blacklistService.determineFailureType('Extraction failed'), 'extraction_failed')
  })

  test('returns extraction_failed for "unpack" errors', ({ assert }) => {
    assert.equal(
      blacklistService.determineFailureType('Unpack error occurred'),
      'extraction_failed'
    )
  })

  test('returns verification_failed for "crc" errors', ({ assert }) => {
    assert.equal(blacklistService.determineFailureType('CRC mismatch'), 'verification_failed')
  })

  test('returns verification_failed for "par2" errors', ({ assert }) => {
    assert.equal(blacklistService.determineFailureType('Par2 repair failed'), 'verification_failed')
  })

  test('returns verification_failed for "verification" errors', ({ assert }) => {
    assert.equal(blacklistService.determineFailureType('Verification error'), 'verification_failed')
  })

  test('returns verification_failed for "repair" errors', ({ assert }) => {
    assert.equal(blacklistService.determineFailureType('Repair needed'), 'verification_failed')
  })

  test('returns import_failed for "import" errors', ({ assert }) => {
    assert.equal(blacklistService.determineFailureType('Import failed'), 'import_failed')
  })

  test('returns missing_files for "missing" errors', ({ assert }) => {
    assert.equal(blacklistService.determineFailureType('Missing articles'), 'missing_files')
  })

  test('defaults to download_failed for unknown errors', ({ assert }) => {
    assert.equal(blacklistService.determineFailureType('Unknown error'), 'download_failed')
  })

  test('is case-insensitive', ({ assert }) => {
    assert.equal(blacklistService.determineFailureType('EXTRACTION ERROR'), 'extraction_failed')
  })
})
