import { useCallback, useEffect, useRef, useState } from 'react'
import { Section } from '@/components/settings/section'
import { RowGroup } from '@/components/settings/row-group'
import { SelectRow, SettingRow, ToggleRow } from '@/components/settings/setting-row'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getJson, send } from '@/components/system/system_api'
import { HW_ACCEL_OPTIONS, type HardwareAccelType, type PlaybackSettings } from './library_catalog'

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Hamster did not answer.'
}

/** GET/PUT /api/v1/settings/playback. `save` sends the whole transcoding block it owns. */
export function usePlaybackSettings() {
  const [data, setData] = useState<PlaybackSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const load = useCallback(async () => {
    setError(null)
    try {
      const next = await getJson<PlaybackSettings>('/api/v1/settings/playback')
      if (mounted.current) setData(next)
    } catch (err) {
      if (mounted.current) setError(`Playback settings could not be loaded: ${message(err)}`)
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = useCallback(async (patch: Partial<PlaybackSettings['transcoding']>) => {
    const current = dataRef.current
    if (!current) throw new Error('Playback settings have not loaded yet.')
    const next = await send<PlaybackSettings>('/api/v1/settings/playback', 'PUT', {
      transcoding: { ...current.transcoding, ...patch },
    })
    if (next && mounted.current) setData(next)
  }, [])

  /** Run the GPU test encodes again, e.g. after installing a runtime. */
  const retest = useCallback(async () => {
    const next = await send<PlaybackSettings>('/api/v1/settings/playback/retest', 'POST')
    if (next && mounted.current) setData(next)
  }, [])

  return { data, error, loading, reload: load, save, retest }
}

export type PlaybackState = ReturnType<typeof usePlaybackSettings>

/** Measured on Quick Sync with a 4K HDR source scaled to 1080p. */
export const ENCODER_SPEEDS = [
  { value: 'quality', label: 'Smallest files' },
  { value: 'balanced', label: 'Balanced: 1.5× faster, ~8% larger' },
  { value: 'fast', label: 'Fastest: 2× faster, ~20% larger' },
]

/** "Quick Sync · VAAPI (ICQ)": what passed a test encode, best first. */
export function describeGpu(data: PlaybackSettings): string {
  const parts: string[] = []
  if (data.gpu?.qsv) parts.push('Quick Sync')
  if (data.gpu?.vaapi) parts.push(`VAAPI (${data.gpu.vaapi})`)
  if (parts.length > 0) return parts.join(' · ')
  return 'None · the CPU handles it'
}

/**
 * Why the GPU methods that failed their test did, one line each, so a missing
 * method is never just absent: "Quick Sync: Intel's VPL GPU runtime is missing".
 */
export function describeGpuFailures(data: PlaybackSettings): string[] {
  const lines: string[] = []
  if (data.gpu && !data.gpu.qsv) {
    lines.push(`Quick Sync: ${data.gpu.qsvReason ?? 'did not pass its test encode'}`)
  }
  if (data.gpu && !data.gpu.vaapi) {
    lines.push(`VAAPI: ${data.gpu.vaapiReason ?? 'did not pass its test encode'}`)
  }
  if (data.gpu?.vaapi === 'CQP') {
    // The same driver package fixes both; name it once.
    const named = lines.some((line) => line.includes('intel-media-va-driver-non-free'))
    lines.push(
      `VAAPI: no constant-quality mode with this driver, so files come out larger${named ? '' : ' (intel-media-va-driver-non-free adds it)'}`
    )
  }
  return lines
}

/**
 * A warning for the Method row when the chosen method does not work here, so
 * picking Quick Sync on a machine without its runtime does not fail silently.
 */
export function methodWarning(data: PlaybackSettings): string | null {
  const method = data.transcoding.hardwareAccelType
  const fallback = data.gpu?.vaapi ? 'VAAPI' : 'the CPU'
  if (method === 'qsv' && data.gpu && !data.gpu.qsv) {
    return `Quick Sync doesn't work on this machine, so ${fallback} is used instead.`
  }
  if (method === 'vaapi' && data.gpu && !data.gpu.vaapi) {
    return "VAAPI doesn't work on this machine, so the CPU is used instead."
  }
  return null
}

/** Which encoder versions will use with these settings, in words. */
export function describeVersionEncoder(data: PlaybackSettings): string {
  const { hardwareAccelType: method, useForVersions } = data.transcoding
  if (!useForVersions || method === 'none') return 'The CPU (x265)'
  if (method === 'cuda' || method === 'videotoolbox') {
    return 'The CPU (x265): versions encode with Quick Sync or VAAPI only'
  }
  if (data.gpu?.qsv && method !== 'vaapi') return 'Intel Quick Sync'
  if (data.gpu?.vaapi) return `VAAPI (${data.gpu.vaapi})`
  return 'The CPU (x265): no GPU encoder works on this device'
}

/**
 * Settings → Media → Hardware acceleration: one GPU setting for everything
 * Hamster encodes or decodes, the way Jellyfin has one. The method and device
 * are shared; streaming and versions each say whether they use them.
 */
export function HardwareSection({ state }: { state: PlaybackState }) {
  const { data, error, loading, reload, save, retest } = state
  const devices = data?.devices ?? []
  const deviceOptions = [
    ...new Set([...(data ? [data.transcoding.vaapiDevice] : []), ...devices]),
  ].map((device) => ({ value: device, label: device }))
  const usesDevice = data && ['auto', 'qsv', 'vaapi'].includes(data.transcoding.hardwareAccelType)

  return (
    <Section
      id="hardware"
      title="Hardware acceleration"
      description="The GPU encodes versions and can help streaming. Only audio a browser can't play is transcoded while streaming; video is copied as is."
    >
      <RowGroup loading={loading} skeletonRows={5} error={error} onRetry={() => void reload()}>
        {data && (
          <SelectRow
            label="Method"
            description={
              methodWarning(data) ??
              'Auto picks the best one that passed a test encode on this machine.'
            }
            value={data.transcoding.hardwareAccelType}
            options={HW_ACCEL_OPTIONS}
            onSave={(value) => save({ hardwareAccelType: value as HardwareAccelType })}
          />
        )}
        {data && usesDevice && deviceOptions.length > 0 && (
          <SelectRow
            label="Device"
            description="The GPU's render node, for Quick Sync and VAAPI."
            value={data.transcoding.vaapiDevice}
            options={deviceOptions}
            onSave={(vaapiDevice) => save({ vaapiDevice })}
          />
        )}
        {data && <GpuTestRow data={data} onRetest={retest} />}
        {data && (
          <ToggleRow
            label="Encode versions"
            description={`Uses: ${describeVersionEncoder(data)}.`}
            checked={data.transcoding.useForVersions}
            onSave={(useForVersions) => save({ useForVersions })}
          />
        )}
        {data && data.transcoding.useForVersions && (
          <SelectRow
            label="Encoding speed"
            description="The picture is the same at every speed; faster makes files a little larger."
            value={data.transcoding.encoderPreset ?? 'balanced'}
            options={ENCODER_SPEEDS}
            onSave={(value) =>
              save({ encoderPreset: value as PlaybackSettings['transcoding']['encoderPreset'] })
            }
          />
        )}
        {data && (
          <ToggleRow
            label="Decode while streaming"
            description="Demux on the GPU for faster seeking in large 4K HEVC files. Experimental."
            checked={data.transcoding.useHardwareAcceleration}
            onSave={(useHardwareAcceleration) => save({ useHardwareAcceleration })}
          />
        )}
      </RowGroup>
    </Section>
  )
}

/**
 * What passed a test encode, why the rest did not, and a way to test again
 * after installing a driver or runtime without restarting Hamster.
 */
function GpuTestRow({ data, onRetest }: { data: PlaybackSettings; onRetest: () => Promise<void> }) {
  const [testing, setTesting] = useState(false)
  const failures = describeGpuFailures(data)

  const retest = async () => {
    setTesting(true)
    try {
      await onRetest()
    } catch (err) {
      toast.error('The test did not run', { description: message(err) })
    } finally {
      setTesting(false)
    }
  }

  return (
    <SettingRow
      stack
      label="Works on this machine"
      description={
        failures.length > 0 ? (
          <span className="block space-y-1">
            {failures.map((line) => (
              <span key={line} className="block break-words">
                {line}
              </span>
            ))}
          </span>
        ) : undefined
      }
      control={
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 md:justify-end">
          <span className="readout text-sm">{describeGpu(data)}</span>
          <Button variant="outline" size="sm" onClick={() => void retest()} disabled={testing}>
            {testing ? 'Testing…' : 'Test again'}
          </Button>
        </div>
      }
    />
  )
}
