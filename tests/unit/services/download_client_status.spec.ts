import { test } from '@japa/runner'

type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'completed' | 'failed'

// Replicate qBittorrent mapStateToStatus
function qbtMapStateToStatus(state: string): DownloadStatus {
  switch (state) {
    case 'allocating':
    case 'metaDL':
    case 'queuedDL':
    case 'checkingDL':
      return 'queued'
    case 'downloading':
    case 'forcedDL':
    case 'stalledDL':
      return 'downloading'
    case 'pausedDL':
    case 'pausedUP':
      return 'paused'
    case 'uploading':
    case 'stalledUP':
    case 'forcedUP':
    case 'queuedUP':
    case 'checkingUP':
    case 'checkingResumeData':
      return 'completed'
    case 'error':
    case 'missingFiles':
      return 'failed'
    default:
      return 'queued'
  }
}

// Replicate Transmission status constants and mapper
const TransmissionStatus = {
  STOPPED: 0,
  CHECK_WAIT: 1,
  CHECK: 2,
  DOWNLOAD_WAIT: 3,
  DOWNLOAD: 4,
  SEED_WAIT: 5,
  SEED: 6,
} as const

function transmissionMapStatus(status: number, isFinished: boolean): DownloadStatus {
  if (isFinished) {
    return 'completed'
  }

  switch (status) {
    case TransmissionStatus.STOPPED:
      return 'paused'
    case TransmissionStatus.CHECK_WAIT:
    case TransmissionStatus.CHECK:
    case TransmissionStatus.DOWNLOAD_WAIT:
      return 'queued'
    case TransmissionStatus.DOWNLOAD:
      return 'downloading'
    case TransmissionStatus.SEED_WAIT:
    case TransmissionStatus.SEED:
      return 'completed'
    default:
      return 'queued'
  }
}

// Replicate NZBGet status mapper
function nzbgetMapStatus(status: string): DownloadStatus {
  if (status === 'QUEUED' || status === 'FETCHING') {
    return 'queued'
  }
  if (status === 'DOWNLOADING') {
    return 'downloading'
  }
  if (status === 'PAUSED') {
    return 'paused'
  }

  if (
    [
      'PP_QUEUED',
      'LOADING_PARS',
      'VERIFYING_SOURCES',
      'REPAIRING',
      'VERIFYING_REPAIRED',
      'RENAMING',
      'UNPACKING',
      'MOVING',
      'EXECUTING_SCRIPT',
    ].includes(status)
  ) {
    return 'downloading'
  }

  if (status === 'SUCCESS') {
    return 'completed'
  }
  if (
    [
      'FAILURE',
      'BAD',
      'DELETED',
      'DUPE',
      'COPY',
      'FETCH_FAILURE',
      'PAR_FAILURE',
      'UNPACK_FAILURE',
      'MOVE_FAILURE',
      'SCRIPT_FAILURE',
      'DISK_FAILURE',
      'HEALTH_FAILURE',
      'DELETED_FAILURE',
    ].includes(status)
  ) {
    return 'failed'
  }

  return 'queued'
}

// Replicate Deluge state mapper
function delugeMapState(state: string, isFinished: boolean): DownloadStatus {
  if (isFinished) {
    return 'completed'
  }

  switch (state) {
    case 'Downloading':
      return 'downloading'
    case 'Seeding':
      return 'completed'
    case 'Paused':
      return 'paused'
    case 'Checking':
    case 'Queued':
    case 'Allocating':
    case 'Moving':
      return 'queued'
    case 'Error':
      return 'failed'
    default:
      return 'queued'
  }
}

test.group('qBittorrent | mapStateToStatus', () => {
  test('maps allocating to queued', ({ assert }) => {
    assert.equal(qbtMapStateToStatus('allocating'), 'queued')
  })

  test('maps metaDL to queued', ({ assert }) => {
    assert.equal(qbtMapStateToStatus('metaDL'), 'queued')
  })

  test('maps queuedDL to queued', ({ assert }) => {
    assert.equal(qbtMapStateToStatus('queuedDL'), 'queued')
  })

  test('maps checkingDL to queued', ({ assert }) => {
    assert.equal(qbtMapStateToStatus('checkingDL'), 'queued')
  })

  test('maps downloading to downloading', ({ assert }) => {
    assert.equal(qbtMapStateToStatus('downloading'), 'downloading')
  })

  test('maps forcedDL to downloading', ({ assert }) => {
    assert.equal(qbtMapStateToStatus('forcedDL'), 'downloading')
  })

  test('maps stalledDL to downloading', ({ assert }) => {
    assert.equal(qbtMapStateToStatus('stalledDL'), 'downloading')
  })

  test('maps pausedDL to paused', ({ assert }) => {
    assert.equal(qbtMapStateToStatus('pausedDL'), 'paused')
  })

  test('maps pausedUP to paused', ({ assert }) => {
    assert.equal(qbtMapStateToStatus('pausedUP'), 'paused')
  })

  test('maps uploading to completed', ({ assert }) => {
    assert.equal(qbtMapStateToStatus('uploading'), 'completed')
  })

  test('maps stalledUP to completed', ({ assert }) => {
    assert.equal(qbtMapStateToStatus('stalledUP'), 'completed')
  })

  test('maps error to failed', ({ assert }) => {
    assert.equal(qbtMapStateToStatus('error'), 'failed')
  })

  test('maps missingFiles to failed', ({ assert }) => {
    assert.equal(qbtMapStateToStatus('missingFiles'), 'failed')
  })

  test('maps unknown state to queued', ({ assert }) => {
    assert.equal(qbtMapStateToStatus('unknownState'), 'queued')
  })
})

test.group('Transmission | mapStatusToDownloadStatus', () => {
  test('returns completed when isFinished is true regardless of status', ({ assert }) => {
    assert.equal(transmissionMapStatus(TransmissionStatus.DOWNLOAD, true), 'completed')
    assert.equal(transmissionMapStatus(TransmissionStatus.STOPPED, true), 'completed')
  })

  test('maps STOPPED to paused', ({ assert }) => {
    assert.equal(transmissionMapStatus(TransmissionStatus.STOPPED, false), 'paused')
  })

  test('maps CHECK_WAIT to queued', ({ assert }) => {
    assert.equal(transmissionMapStatus(TransmissionStatus.CHECK_WAIT, false), 'queued')
  })

  test('maps CHECK to queued', ({ assert }) => {
    assert.equal(transmissionMapStatus(TransmissionStatus.CHECK, false), 'queued')
  })

  test('maps DOWNLOAD_WAIT to queued', ({ assert }) => {
    assert.equal(transmissionMapStatus(TransmissionStatus.DOWNLOAD_WAIT, false), 'queued')
  })

  test('maps DOWNLOAD to downloading', ({ assert }) => {
    assert.equal(transmissionMapStatus(TransmissionStatus.DOWNLOAD, false), 'downloading')
  })

  test('maps SEED_WAIT to completed', ({ assert }) => {
    assert.equal(transmissionMapStatus(TransmissionStatus.SEED_WAIT, false), 'completed')
  })

  test('maps SEED to completed', ({ assert }) => {
    assert.equal(transmissionMapStatus(TransmissionStatus.SEED, false), 'completed')
  })

  test('maps unknown status to queued', ({ assert }) => {
    assert.equal(transmissionMapStatus(99, false), 'queued')
  })
})

test.group('NZBGet | mapStatusToDownloadStatus', () => {
  test('maps QUEUED to queued', ({ assert }) => {
    assert.equal(nzbgetMapStatus('QUEUED'), 'queued')
  })

  test('maps FETCHING to queued', ({ assert }) => {
    assert.equal(nzbgetMapStatus('FETCHING'), 'queued')
  })

  test('maps DOWNLOADING to downloading', ({ assert }) => {
    assert.equal(nzbgetMapStatus('DOWNLOADING'), 'downloading')
  })

  test('maps PAUSED to paused', ({ assert }) => {
    assert.equal(nzbgetMapStatus('PAUSED'), 'paused')
  })

  test('maps post-processing statuses to downloading', ({ assert }) => {
    const ppStatuses = [
      'PP_QUEUED',
      'LOADING_PARS',
      'VERIFYING_SOURCES',
      'REPAIRING',
      'VERIFYING_REPAIRED',
      'RENAMING',
      'UNPACKING',
      'MOVING',
      'EXECUTING_SCRIPT',
    ]
    for (const status of ppStatuses) {
      assert.equal(
        nzbgetMapStatus(status),
        'downloading',
        `Expected ${status} to map to downloading`
      )
    }
  })

  test('maps SUCCESS to completed', ({ assert }) => {
    assert.equal(nzbgetMapStatus('SUCCESS'), 'completed')
  })

  test('maps failure statuses to failed', ({ assert }) => {
    const failStatuses = [
      'FAILURE',
      'BAD',
      'DELETED',
      'DUPE',
      'COPY',
      'FETCH_FAILURE',
      'PAR_FAILURE',
      'UNPACK_FAILURE',
      'MOVE_FAILURE',
      'SCRIPT_FAILURE',
      'DISK_FAILURE',
      'HEALTH_FAILURE',
      'DELETED_FAILURE',
    ]
    for (const status of failStatuses) {
      assert.equal(nzbgetMapStatus(status), 'failed', `Expected ${status} to map to failed`)
    }
  })

  test('maps unknown status to queued', ({ assert }) => {
    assert.equal(nzbgetMapStatus('UNKNOWN'), 'queued')
  })
})

test.group('Deluge | mapStateToStatus', () => {
  test('returns completed when isFinished is true', ({ assert }) => {
    assert.equal(delugeMapState('Downloading', true), 'completed')
    assert.equal(delugeMapState('Paused', true), 'completed')
  })

  test('maps Downloading to downloading', ({ assert }) => {
    assert.equal(delugeMapState('Downloading', false), 'downloading')
  })

  test('maps Seeding to completed', ({ assert }) => {
    assert.equal(delugeMapState('Seeding', false), 'completed')
  })

  test('maps Paused to paused', ({ assert }) => {
    assert.equal(delugeMapState('Paused', false), 'paused')
  })

  test('maps Checking to queued', ({ assert }) => {
    assert.equal(delugeMapState('Checking', false), 'queued')
  })

  test('maps Queued to queued', ({ assert }) => {
    assert.equal(delugeMapState('Queued', false), 'queued')
  })

  test('maps Allocating to queued', ({ assert }) => {
    assert.equal(delugeMapState('Allocating', false), 'queued')
  })

  test('maps Moving to queued', ({ assert }) => {
    assert.equal(delugeMapState('Moving', false), 'queued')
  })

  test('maps Error to failed', ({ assert }) => {
    assert.equal(delugeMapState('Error', false), 'failed')
  })

  test('maps unknown state to queued', ({ assert }) => {
    assert.equal(delugeMapState('Unknown', false), 'queued')
  })
})
