import { Head } from '@inertiajs/react'
import { useEffect, useState } from 'react'
import { AppLayout } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectPopup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
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
      toast.error('Failed to load playback settings')
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
        toast.error('Failed to update settings')
      }
    } catch (error) {
      toast.error('Failed to update settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AppLayout title="Playback Settings">
        <Head title="Playback Settings" />
        <div className="text-muted-foreground">Loading...</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Playback Settings">
      <Head title="Playback Settings" />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Video Transcoding</CardTitle>
            <CardDescription>
              Configure how videos with incompatible audio codecs (AC3, DTS, TrueHD) are transcoded for browser playback.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Hardware Acceleration Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="hw-accel">Hardware Acceleration</Label>
                <p className="text-sm text-muted-foreground">
                  Use GPU for faster video processing when seeking
                </p>
              </div>
              <Switch
                id="hw-accel"
                checked={settings?.transcoding.useHardwareAcceleration ?? false}
                onCheckedChange={(checked) =>
                  updateSettings({ useHardwareAcceleration: checked })
                }
                disabled={saving}
              />
            </div>

            {/* Hardware Acceleration Type */}
            {settings?.transcoding.useHardwareAcceleration && (
              <div className="space-y-2">
                <Label htmlFor="hw-type">Acceleration Type</Label>
                <Select
                  value={settings?.transcoding.hardwareAccelType ?? 'auto'}
                  onValueChange={(value) =>
                    updateSettings({
                      hardwareAccelType: value as TranscodingSettings['hardwareAccelType'],
                    })
                  }
                  disabled={saving}
                >
                  <SelectTrigger className="w-64">
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

                {/* Available Hardware */}
                <div className="pt-2">
                  <p className="text-sm text-muted-foreground mb-2">
                    Detected hardware acceleration:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {settings?.availableHardwareAccel.length === 0 ? (
                      <Badge variant="outline" className="text-muted-foreground">
                        None available
                      </Badge>
                    ) : (
                      settings?.availableHardwareAccel.map((hw) => (
                        <Badge key={hw} variant="secondary">
                          {hwAccelLabels[hw] || hw}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Info Box */}
            <div className="rounded-lg border bg-muted/50 p-4 mt-4">
              <h4 className="font-medium mb-2">About Transcoding</h4>
              <p className="text-sm text-muted-foreground">
                Video transcoding is only used when the source file has audio codecs that browsers
                cannot play natively (such as AC3, DTS, or TrueHD commonly found in Blu-ray rips).
                The video stream is copied without re-encoding, only the audio is transcoded to AAC.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                <strong>Hardware acceleration</strong> can speed up seeking in large files (like 4K
                HEVC content) by using your GPU for video demuxing. Note: This is experimental and
                may cause playback issues with some files.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
