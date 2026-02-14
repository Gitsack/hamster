import { test } from '@japa/runner'

// Replicate private mapSabnzbdStatus from DownloadManager
function mapSabnzbdStatus(
  status: string
): 'queued' | 'downloading' | 'paused' | 'completed' | 'failed' | 'importing' {
  switch (status) {
    case 'Downloading':
    case 'Grabbing':
    case 'Fetching':
      return 'downloading'
    case 'Paused':
      return 'paused'
    case 'Queued':
      return 'queued'
    case 'Verifying':
    case 'Repairing':
    case 'Extracting':
    case 'Moving':
    case 'Running':
      return 'importing'
    default:
      return 'queued'
  }
}

// Replicate private parseTimeLeft from DownloadManager
function parseTimeLeft(timeleft: string): number {
  if (!timeleft || timeleft === 'Unknown') return 0

  const parts = timeleft.split(':')
  if (parts.length === 3) {
    return (
      Number.parseInt(parts[0]) * 3600 + Number.parseInt(parts[1]) * 60 + Number.parseInt(parts[2])
    )
  }
  return 0
}

test.group('DownloadManager | mapSabnzbdStatus', () => {
  test('maps Downloading to downloading', ({ assert }) => {
    assert.equal(mapSabnzbdStatus('Downloading'), 'downloading')
  })

  test('maps Grabbing to downloading', ({ assert }) => {
    assert.equal(mapSabnzbdStatus('Grabbing'), 'downloading')
  })

  test('maps Fetching to downloading', ({ assert }) => {
    assert.equal(mapSabnzbdStatus('Fetching'), 'downloading')
  })

  test('maps Paused to paused', ({ assert }) => {
    assert.equal(mapSabnzbdStatus('Paused'), 'paused')
  })

  test('maps Queued to queued', ({ assert }) => {
    assert.equal(mapSabnzbdStatus('Queued'), 'queued')
  })

  test('maps Verifying to importing', ({ assert }) => {
    assert.equal(mapSabnzbdStatus('Verifying'), 'importing')
  })

  test('maps Repairing to importing', ({ assert }) => {
    assert.equal(mapSabnzbdStatus('Repairing'), 'importing')
  })

  test('maps Extracting to importing', ({ assert }) => {
    assert.equal(mapSabnzbdStatus('Extracting'), 'importing')
  })

  test('maps Moving to importing', ({ assert }) => {
    assert.equal(mapSabnzbdStatus('Moving'), 'importing')
  })

  test('maps Running to importing', ({ assert }) => {
    assert.equal(mapSabnzbdStatus('Running'), 'importing')
  })

  test('maps unknown status to queued', ({ assert }) => {
    assert.equal(mapSabnzbdStatus('SomeUnknownStatus'), 'queued')
  })

  test('maps empty string to queued', ({ assert }) => {
    assert.equal(mapSabnzbdStatus(''), 'queued')
  })
})

test.group('DownloadManager | parseTimeLeft', () => {
  test('parses HH:MM:SS format', ({ assert }) => {
    assert.equal(parseTimeLeft('01:30:45'), 1 * 3600 + 30 * 60 + 45)
  })

  test('parses zero time', ({ assert }) => {
    assert.equal(parseTimeLeft('00:00:00'), 0)
  })

  test('parses hours only', ({ assert }) => {
    assert.equal(parseTimeLeft('02:00:00'), 7200)
  })

  test('parses minutes only', ({ assert }) => {
    assert.equal(parseTimeLeft('00:15:00'), 900)
  })

  test('parses seconds only', ({ assert }) => {
    assert.equal(parseTimeLeft('00:00:30'), 30)
  })

  test('returns 0 for empty string', ({ assert }) => {
    assert.equal(parseTimeLeft(''), 0)
  })

  test('returns 0 for Unknown', ({ assert }) => {
    assert.equal(parseTimeLeft('Unknown'), 0)
  })

  test('returns 0 for invalid format', ({ assert }) => {
    assert.equal(parseTimeLeft('5 minutes'), 0)
  })

  test('returns 0 for two-part format', ({ assert }) => {
    assert.equal(parseTimeLeft('15:30'), 0)
  })

  test('handles large hour values', ({ assert }) => {
    assert.equal(parseTimeLeft('100:00:00'), 360000)
  })
})
