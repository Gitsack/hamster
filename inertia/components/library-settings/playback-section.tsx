import { useCallback, useEffect, useRef, useState } from 'react'
import { Section } from '@/components/settings/section'
import { RowGroup } from '@/components/settings/row-group'
import { ReadoutRow, SelectRow, ToggleRow } from '@/components/settings/setting-row'
import { getJson, send } from '@/components/system/system_api'
import {
  HW_ACCEL_NAMES,
  HW_ACCEL_OPTIONS,
  type HardwareAccelType,
  type PlaybackSettings,
} from './library_catalog'

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

  return { data, error, loading, reload: load, save }
}

export type PlaybackState = ReturnType<typeof usePlaybackSettings>

/**
 * Settings → Media → Playback: hardware acceleration for the transcoder. What
 * used to be a card of prose about when transcoding runs is the one-line
 * description; nothing about it is configurable.
 */
export function PlaybackSection({ state }: { state: PlaybackState }) {
  const { data, error, loading, reload, save } = state
  const hardware = data?.transcoding.useHardwareAcceleration ?? false
  const detected = data?.availableHardwareAccel ?? []

  return (
    <Section
      id="playback"
      title="Playback"
      description="Only audio a browser can't play (AC3, DTS, TrueHD) is transcoded, to AAC; video is copied as is."
    >
      <RowGroup loading={loading} skeletonRows={3} error={error} onRetry={() => void reload()}>
        {data && (
          <ToggleRow
            label="Hardware acceleration"
            description="Demux on the GPU for faster seeking in large 4K HEVC files. Experimental."
            checked={hardware}
            onSave={(useHardwareAcceleration) => save({ useHardwareAcceleration })}
          />
        )}
        {data && (
          <SelectRow
            label="Acceleration type"
            description={
              hardware
                ? 'Auto-detect picks the first backend this machine reports.'
                : 'Used once hardware acceleration is on.'
            }
            value={data.transcoding.hardwareAccelType}
            options={HW_ACCEL_OPTIONS}
            disabled={!hardware}
            onSave={(value) => save({ hardwareAccelType: value as HardwareAccelType })}
          />
        )}
        {data && (
          <ReadoutRow
            label="Detected on this machine"
            value={
              detected.length > 0
                ? detected.map((hw) => HW_ACCEL_NAMES[hw] ?? hw).join(' · ')
                : 'None · the CPU handles it'
            }
          />
        )}
      </RowGroup>
    </Section>
  )
}
