import { Head } from '@inertiajs/react'
import { useEffect, useState } from 'react'
import { AppLayout } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectPopup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

interface TranscodingSettings {
  useHardwareAcceleration: boolean
  hardwareAccelType: 'auto' | 'videotoolbox' | 'cuda' | 'qsv' | 'vaapi' | 'none'
}

interface PlaybackSettings {
  transcoding: TranscodingSettings
  availableHardwareAccel: string[]
}

const hwAccelLabels: Record<string, string> = {
  auto: 'Auto-detect',
  videotoolbox: 'VideoToolbox (macOS)',
  cuda: 'CUDA (NVIDIA)',
  qsv: 'Quick Sync (Intel)',
  vaapi: 'VAAPI (Linux)',
  none: 'Disabled',
}

export default function PlaybackSettingsPage() {
  const [settings, setSettings] = useState<PlaybackSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/v1/settings/playback')
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
      }
    } catch (error) {
      toast.error(
        'Playback settings could not be loaded — Hamster is unreachable. Reload to retry.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const updateSettings = async (transcoding: Partial<TranscodingSettings>) => {
    if (!settings) return

    setSaving(true)
    try {
      const response = await fetch('/api/v1/settings/playback', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcoding: { ...settings.transcoding, ...transcoding },
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setSettings(data)
        toast.success('Playback settings updated')
      } else {
        toast.error(
          'Transcoding settings not saved — the server rejected the change. Check the server log and try again.'
        )
      }
    } catch (error) {
      toast.error(
        'Transcoding settings not saved — Hamster is unreachable. Check the server and try again.'
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AppLayout title="Playback Settings">
        <Head title="Playback Settings" />
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-72" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-2/3" />
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    )
  }

  const hardwareEnabled = settings?.transcoding.useHardwareAcceleration ?? false
  const detected = settings?.availableHardwareAccel ?? []

  return (
    <AppLayout title="Playback Settings">
      <Head title="Playback Settings" />

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Video Transcoding</CardTitle>
            <CardDescription>
              How Hamster handles files whose audio a browser cannot play natively — AC3, DTS and
              TrueHD. The video stream is copied untouched; only the audio is re-encoded to AAC.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Hardware Acceleration Toggle */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <Label htmlFor="hw-accel">Hardware acceleration</Label>
                <p className="text-xs text-muted-foreground">
                  Use the GPU to demux video, which speeds up seeking in large 4K HEVC files.
                  Experimental — some files may stutter or fail to play.
                </p>
              </div>
              <Switch
                id="hw-accel"
                checked={hardwareEnabled}
                onCheckedChange={(checked) => updateSettings({ useHardwareAcceleration: checked })}
                disabled={saving}
              />
            </div>

            {/* Hardware Acceleration Type */}
            {hardwareEnabled && (
              <div className="space-y-6 border-t border-border pt-6">
                <div className="space-y-2">
                  <Label htmlFor="hw-type">Acceleration type</Label>
                  <Select
                    value={settings?.transcoding.hardwareAccelType ?? 'auto'}
                    onValueChange={(value) =>
                      updateSettings({
                        hardwareAccelType: value as TranscodingSettings['hardwareAccelType'],
                      })
                    }
                    disabled={saving}
                  >
                    <SelectTrigger id="hw-type" className="w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectItem value="auto">Auto-detect (Recommended)</SelectItem>
                      <SelectItem value="videotoolbox">VideoToolbox (macOS)</SelectItem>
                      <SelectItem value="cuda">CUDA (NVIDIA)</SelectItem>
                      <SelectItem value="qsv">Quick Sync (Intel)</SelectItem>
                      <SelectItem value="vaapi">VAAPI (Linux)</SelectItem>
                      <SelectItem value="none">None (CPU only)</SelectItem>
                    </SelectPopup>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Auto-detect picks the first backend this machine reports.
                  </p>
                </div>

                {/* Available Hardware */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Detected on this machine
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {detected.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No GPU backend detected. Playback falls back to the CPU, which still works
                        but seeks more slowly.
                      </p>
                    ) : (
                      detected.map((hw) => (
                        <Badge key={hw} variant="secondary">
                          {hwAccelLabels[hw] || hw}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>When transcoding runs</CardTitle>
            <CardDescription>
              What triggers a transcode, and what it costs. Nothing here is configurable.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              A transcode starts only when the source file carries an audio codec the browser cannot
              decode — typically AC3, DTS or TrueHD from a Blu-ray rip. Everything else streams
              directly from disk.
            </p>
            <p>
              The video stream is remuxed, never re-encoded, so picture quality is unchanged and CPU
              cost stays low. Only the audio track is converted to AAC.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
