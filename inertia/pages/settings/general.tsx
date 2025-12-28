import { Head } from '@inertiajs/react'
import { useEffect, useState } from 'react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { HugeiconsIcon } from '@hugeicons/react'
import { Delete02Icon, Add01Icon, Edit02Icon } from '@hugeicons/core-free-icons'
import { toast } from 'sonner'

interface QualityItem {
  id: number
  name: string
  allowed: boolean
}

interface QualityProfile {
  id: number
  name: string
  cutoff: number
  upgradeAllowed: boolean
  items: QualityItem[]
}

interface MetadataProfile {
  id: number
  name: string
  primaryAlbumTypes: string[]
  secondaryAlbumTypes: string[]
  releaseStatuses: string[]
}

const QUALITY_OPTIONS = [
  { id: 1, name: 'FLAC' },
  { id: 2, name: 'ALAC' },
  { id: 3, name: 'WAV' },
  { id: 4, name: 'MP3 320' },
  { id: 5, name: 'MP3 V0' },
  { id: 6, name: 'MP3 256' },
  { id: 7, name: 'MP3 192' },
  { id: 8, name: 'AAC 256' },
  { id: 9, name: 'OGG Vorbis' },
]

const PRIMARY_ALBUM_TYPES = ['Album', 'EP', 'Single', 'Broadcast', 'Other']
const SECONDARY_ALBUM_TYPES = ['Studio', 'Compilation', 'Soundtrack', 'Spokenword', 'Interview', 'Audiobook', 'Live', 'Remix', 'DJ-mix', 'Mixtape/Street', 'Demo']

export default function General() {
  const [qualityProfiles, setQualityProfiles] = useState<QualityProfile[]>([])
  const [metadataProfiles, setMetadataProfiles] = useState<MetadataProfile[]>([])
  const [loading, setLoading] = useState(true)

  // Quality profile dialog state
  const [qualityDialogOpen, setQualityDialogOpen] = useState(false)
  const [editingQuality, setEditingQuality] = useState<QualityProfile | null>(null)
  const [qualityName, setQualityName] = useState('')
  const [qualityItems, setQualityItems] = useState<QualityItem[]>([])
  const [qualityCutoff, setQualityCutoff] = useState(1)
  const [qualityUpgradeAllowed, setQualityUpgradeAllowed] = useState(true)

  // Metadata profile dialog state
  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false)
  const [editingMetadata, setEditingMetadata] = useState<MetadataProfile | null>(null)
  const [metadataName, setMetadataName] = useState('')
  const [primaryTypes, setPrimaryTypes] = useState<string[]>([])
  const [secondaryTypes, setSecondaryTypes] = useState<string[]>([])

  const [saving, setSaving] = useState(false)

  const fetchProfiles = async () => {
    try {
      const [qualityRes, metadataRes] = await Promise.all([
        fetch('/api/v1/qualityprofiles'),
        fetch('/api/v1/metadataprofiles'),
      ])

      if (qualityRes.ok) {
        setQualityProfiles(await qualityRes.json())
      }
      if (metadataRes.ok) {
        setMetadataProfiles(await metadataRes.json())
      }
    } catch (error) {
      toast.error('Failed to load profiles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfiles()
  }, [])

  const openQualityDialog = (profile?: QualityProfile) => {
    if (profile) {
      setEditingQuality(profile)
      setQualityName(profile.name)
      setQualityItems(profile.items)
      setQualityCutoff(profile.cutoff)
      setQualityUpgradeAllowed(profile.upgradeAllowed)
    } else {
      setEditingQuality(null)
      setQualityName('')
      setQualityItems(QUALITY_OPTIONS.map((q) => ({ ...q, allowed: true })))
      setQualityCutoff(1)
      setQualityUpgradeAllowed(true)
    }
    setQualityDialogOpen(true)
  }

  const handleSaveQuality = async () => {
    if (!qualityName.trim()) {
      toast.error('Name is required')
      return
    }

    setSaving(true)
    try {
      const method = editingQuality ? 'PUT' : 'POST'
      const url = editingQuality
        ? `/api/v1/qualityprofiles/${editingQuality.id}`
        : '/api/v1/qualityprofiles'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: qualityName,
          cutoff: qualityCutoff,
          upgradeAllowed: qualityUpgradeAllowed,
          items: qualityItems,
        }),
      })

      if (response.ok) {
        toast.success(editingQuality ? 'Profile updated' : 'Profile created')
        setQualityDialogOpen(false)
        fetchProfiles()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save profile')
      }
    } catch (error) {
      toast.error('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteQuality = async (id: number) => {
    try {
      const response = await fetch(`/api/v1/qualityprofiles/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Profile deleted')
        fetchProfiles()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete profile')
      }
    } catch (error) {
      toast.error('Failed to delete profile')
    }
  }

  const openMetadataDialog = (profile?: MetadataProfile) => {
    if (profile) {
      setEditingMetadata(profile)
      setMetadataName(profile.name)
      setPrimaryTypes(profile.primaryAlbumTypes)
      setSecondaryTypes(profile.secondaryAlbumTypes)
    } else {
      setEditingMetadata(null)
      setMetadataName('')
      setPrimaryTypes(['Album', 'EP'])
      setSecondaryTypes(['Studio'])
    }
    setMetadataDialogOpen(true)
  }

  const handleSaveMetadata = async () => {
    if (!metadataName.trim()) {
      toast.error('Name is required')
      return
    }

    setSaving(true)
    try {
      const method = editingMetadata ? 'PUT' : 'POST'
      const url = editingMetadata
        ? `/api/v1/metadataprofiles/${editingMetadata.id}`
        : '/api/v1/metadataprofiles'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: metadataName,
          primaryAlbumTypes: primaryTypes,
          secondaryAlbumTypes: secondaryTypes,
          releaseStatuses: ['Official'],
        }),
      })

      if (response.ok) {
        toast.success(editingMetadata ? 'Profile updated' : 'Profile created')
        setMetadataDialogOpen(false)
        fetchProfiles()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save profile')
      }
    } catch (error) {
      toast.error('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteMetadata = async (id: number) => {
    try {
      const response = await fetch(`/api/v1/metadataprofiles/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Profile deleted')
        fetchProfiles()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete profile')
      }
    } catch (error) {
      toast.error('Failed to delete profile')
    }
  }

  const toggleQualityItem = (id: number) => {
    setQualityItems((items) =>
      items.map((item) =>
        item.id === id ? { ...item, allowed: !item.allowed } : item
      )
    )
  }

  const togglePrimaryType = (type: string) => {
    setPrimaryTypes((types) =>
      types.includes(type) ? types.filter((t) => t !== type) : [...types, type]
    )
  }

  const toggleSecondaryType = (type: string) => {
    setSecondaryTypes((types) =>
      types.includes(type) ? types.filter((t) => t !== type) : [...types, type]
    )
  }

  return (
    <AppLayout title="General Settings">
      <Head title="General Settings" />

      <div className="space-y-6">
        {/* Quality Profiles */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Quality Profiles</CardTitle>
                <CardDescription>
                  Define which audio qualities are acceptable for downloads
                </CardDescription>
              </div>
              <Dialog open={qualityDialogOpen} onOpenChange={setQualityDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => openQualityDialog()}>
                    <HugeiconsIcon icon={Add01Icon} className="mr-2 size-4" />
                    Add Profile
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      {editingQuality ? 'Edit Quality Profile' : 'Add Quality Profile'}
                    </DialogTitle>
                    <DialogDescription>
                      Configure which audio qualities are allowed.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="quality-name">Name</Label>
                      <Input
                        id="quality-name"
                        value={qualityName}
                        onChange={(e) => setQualityName(e.target.value)}
                        placeholder="Profile name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Allowed Qualities</Label>
                      <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                        {qualityItems.map((item) => (
                          <div key={item.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`quality-${item.id}`}
                              checked={item.allowed}
                              onCheckedChange={() => toggleQualityItem(item.id)}
                            />
                            <label
                              htmlFor={`quality-${item.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {item.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="upgrade-allowed"
                        checked={qualityUpgradeAllowed}
                        onCheckedChange={(checked) =>
                          setQualityUpgradeAllowed(checked as boolean)
                        }
                      />
                      <label
                        htmlFor="upgrade-allowed"
                        className="text-sm font-medium leading-none"
                      >
                        Upgrades Allowed
                      </label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setQualityDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleSaveQuality} disabled={saving}>
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : qualityProfiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No quality profiles configured.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Qualities</TableHead>
                    <TableHead>Upgrades</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {qualityProfiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">{profile.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {profile.items
                            .filter((item) => item.allowed)
                            .slice(0, 3)
                            .map((item) => (
                              <Badge key={item.id} variant="secondary">
                                {item.name}
                              </Badge>
                            ))}
                          {profile.items.filter((item) => item.allowed).length > 3 && (
                            <Badge variant="outline">
                              +{profile.items.filter((item) => item.allowed).length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {profile.upgradeAllowed ? 'Yes' : 'No'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openQualityDialog(profile)}
                          >
                            <HugeiconsIcon icon={Edit02Icon} className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteQuality(profile.id)}
                          >
                            <HugeiconsIcon
                              icon={Delete02Icon}
                              className="size-4 text-destructive"
                            />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Metadata Profiles */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Metadata Profiles</CardTitle>
                <CardDescription>
                  Define which album types to include in your library
                </CardDescription>
              </div>
              <Dialog open={metadataDialogOpen} onOpenChange={setMetadataDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => openMetadataDialog()}>
                    <HugeiconsIcon icon={Add01Icon} className="mr-2 size-4" />
                    Add Profile
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      {editingMetadata ? 'Edit Metadata Profile' : 'Add Metadata Profile'}
                    </DialogTitle>
                    <DialogDescription>
                      Configure which album types are included.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="metadata-name">Name</Label>
                      <Input
                        id="metadata-name"
                        value={metadataName}
                        onChange={(e) => setMetadataName(e.target.value)}
                        placeholder="Profile name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Primary Album Types</Label>
                      <div className="flex flex-wrap gap-2 border rounded-md p-3">
                        {PRIMARY_ALBUM_TYPES.map((type) => (
                          <div key={type} className="flex items-center space-x-2">
                            <Checkbox
                              id={`primary-${type}`}
                              checked={primaryTypes.includes(type)}
                              onCheckedChange={() => togglePrimaryType(type)}
                            />
                            <label
                              htmlFor={`primary-${type}`}
                              className="text-sm font-medium leading-none"
                            >
                              {type}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Secondary Album Types</Label>
                      <div className="flex flex-wrap gap-2 border rounded-md p-3 max-h-36 overflow-y-auto">
                        {SECONDARY_ALBUM_TYPES.map((type) => (
                          <div key={type} className="flex items-center space-x-2">
                            <Checkbox
                              id={`secondary-${type}`}
                              checked={secondaryTypes.includes(type)}
                              onCheckedChange={() => toggleSecondaryType(type)}
                            />
                            <label
                              htmlFor={`secondary-${type}`}
                              className="text-sm font-medium leading-none"
                            >
                              {type}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setMetadataDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleSaveMetadata} disabled={saving}>
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : metadataProfiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No metadata profiles configured.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Primary Types</TableHead>
                    <TableHead>Secondary Types</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metadataProfiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">{profile.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {profile.primaryAlbumTypes.slice(0, 3).map((type) => (
                            <Badge key={type} variant="secondary">
                              {type}
                            </Badge>
                          ))}
                          {profile.primaryAlbumTypes.length > 3 && (
                            <Badge variant="outline">
                              +{profile.primaryAlbumTypes.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {profile.secondaryAlbumTypes.slice(0, 2).map((type) => (
                            <Badge key={type} variant="outline">
                              {type}
                            </Badge>
                          ))}
                          {profile.secondaryAlbumTypes.length > 2 && (
                            <Badge variant="outline">
                              +{profile.secondaryAlbumTypes.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openMetadataDialog(profile)}
                          >
                            <HugeiconsIcon icon={Edit02Icon} className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteMetadata(profile.id)}
                          >
                            <HugeiconsIcon
                              icon={Delete02Icon}
                              className="size-4 text-destructive"
                            />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
