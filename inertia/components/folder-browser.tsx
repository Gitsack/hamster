import { useState, useEffect, useCallback, useId } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Folder01Icon,
  Home01Icon,
  ArrowUp01Icon,
  Alert02Icon,
  CheckmarkCircle02Icon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
}

interface BrowseResponse {
  path: string
  parent: string | null
  directories: DirectoryEntry[]
}

interface QuickPath {
  name: string
  path: string
  isDirectory: boolean
}

interface PathCheckResult {
  exists: boolean
  isDirectory: boolean
  path: string
}

interface FolderBrowserProps {
  value: string
  onChange: (path: string) => void
  onCreateIfMissingChange?: (create: boolean) => void
  createIfMissing?: boolean
  className?: string
  /** Hide the "Select This Folder" button when selection is automatic via onChange */
  hideSelectButton?: boolean
}

export function FolderBrowser({
  value,
  onChange,
  onCreateIfMissingChange,
  createIfMissing = false,
  className,
  hideSelectButton = false,
}: FolderBrowserProps) {
  const [currentPath, setCurrentPath] = useState('')
  const [directories, setDirectories] = useState<DirectoryEntry[]>([])
  const [parentPath, setParentPath] = useState<string | null>(null)
  const [quickPaths, setQuickPaths] = useState<QuickPath[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState(value)
  const [pathStatus, setPathStatus] = useState<PathCheckResult | null>(null)
  const [checkingPath, setCheckingPath] = useState(false)
  // Two browsers can be mounted at once (complete + temporary paths), so the
  // field ids have to be unique per instance.
  const fieldId = useId()

  // Fetch quick paths on mount
  useEffect(() => {
    fetchQuickPaths()
    // Start browsing from home or root
    browse('')
  }, [])

  // Update input when value prop changes
  useEffect(() => {
    setInputValue(value)
  }, [value])

  // Check path status when input changes (debounced)
  useEffect(() => {
    if (!inputValue) {
      setPathStatus(null)
      return
    }

    const timer = setTimeout(() => {
      checkPath(inputValue)
    }, 300)

    return () => clearTimeout(timer)
  }, [inputValue])

  const fetchQuickPaths = async () => {
    try {
      const response = await fetch('/api/v1/filesystem/quick-paths')
      if (response.ok) {
        const data = await response.json()
        setQuickPaths(data.paths)
      }
    } catch {
      // Ignore errors for quick paths
    }
  }

  const checkPath = async (pathToCheck: string) => {
    setCheckingPath(true)
    try {
      const url = new URL('/api/v1/filesystem/check', window.location.origin)
      url.searchParams.set('path', pathToCheck)

      const response = await fetch(url.toString())
      if (response.ok) {
        const data: PathCheckResult = await response.json()
        setPathStatus(data)
      }
    } catch {
      setPathStatus(null)
    } finally {
      setCheckingPath(false)
    }
  }

  const browse = async (path: string) => {
    setLoading(true)
    setError(null)

    try {
      const url = new URL('/api/v1/filesystem/browse', window.location.origin)
      if (path) {
        url.searchParams.set('path', path)
      }

      const response = await fetch(url.toString())
      if (response.ok) {
        const data: BrowseResponse = await response.json()
        setCurrentPath(data.path)
        setDirectories(data.directories)
        setParentPath(data.parent)
      } else {
        const errorData = await response.json()
        setError(
          errorData.error ||
            'Could not read that directory. Check the path exists and that Hamster has permission to read it.'
        )
      }
    } catch {
      setError('Hamster is unreachable, so the folder list could not be loaded. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDirectoryClick = (dir: DirectoryEntry) => {
    browse(dir.path)
    setInputValue(dir.path)
    onChange(dir.path)
  }

  const handleGoUp = () => {
    if (parentPath !== null) {
      browse(parentPath)
      setInputValue(parentPath)
      onChange(parentPath)
    }
  }

  const handleQuickPath = (path: string) => {
    browse(path)
    setInputValue(path)
    onChange(path)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    onChange(e.target.value)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && pathStatus?.exists && pathStatus?.isDirectory) {
      browse(inputValue)
    }
  }

  const handleSelectCurrent = () => {
    onChange(currentPath)
    setInputValue(currentPath)
  }

  const handleCreateIfMissingChange = useCallback(
    (checked: boolean) => {
      onCreateIfMissingChange?.(checked)
    },
    [onCreateIfMissingChange]
  )

  return (
    <div className={cn('space-y-3', className)}>
      {/* Path input */}
      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-path`}>Path</Label>
        <Input
          id={`${fieldId}-path`}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          placeholder="/path/to/folder"
          className="readout"
        />
        {/* Path status indicator */}
        {inputValue && !checkingPath && pathStatus && (
          <div className="flex flex-wrap items-center gap-2">
            {pathStatus.exists && pathStatus.isDirectory ? (
              <Badge className="border-transparent bg-status-complete text-white">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} />
                Folder found
              </Badge>
            ) : pathStatus.exists && !pathStatus.isDirectory ? (
              <>
                <Badge className="border-transparent bg-status-failed text-white">
                  <HugeiconsIcon icon={Alert02Icon} />
                  Not a folder
                </Badge>
                <span className="text-xs text-muted-foreground">
                  That path is a file. Point at the folder that contains it.
                </span>
              </>
            ) : (
              <>
                <Badge className="border-transparent bg-status-queued text-white">
                  <HugeiconsIcon icon={Alert02Icon} />
                  Not on disk yet
                </Badge>
                {onCreateIfMissingChange ? (
                  <div className="ml-auto flex items-center gap-2">
                    <Checkbox
                      id={`${fieldId}-create`}
                      checked={createIfMissing}
                      onCheckedChange={handleCreateIfMissingChange}
                    />
                    <Label htmlFor={`${fieldId}-create`} className="cursor-pointer font-normal">
                      Create it on save
                    </Label>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Create the folder first, or pick one below.
                  </span>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Quick access buttons */}
      {quickPaths.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quickPaths.map((qp) => (
            <Button
              key={qp.path}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickPath(qp.path)}
            >
              <HugeiconsIcon icon={qp.name === 'Home' ? Home01Icon : Folder01Icon} />
              {qp.name}
            </Button>
          ))}
        </div>
      )}

      {/* Current path and navigation */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleGoUp}
          disabled={parentPath === null || loading}
        >
          <HugeiconsIcon icon={ArrowUp01Icon} />
          Up
        </Button>
        <span className="readout flex-1 truncate text-xs text-muted-foreground">
          {currentPath || '/'}
        </span>
        {!hideSelectButton && (
          <Button type="button" variant="secondary" size="sm" onClick={handleSelectCurrent}>
            Select this folder
          </Button>
        )}
      </div>

      {/* Directory listing */}
      <ScrollArea className="h-48 rounded-md border border-border">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner className="size-5 text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-destructive">
            {error}
          </div>
        ) : directories.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
            No subfolders here. Type a path above or go up a level.
          </div>
        ) : (
          <div className="p-1">
            {directories.map((dir) => (
              <button
                key={dir.path}
                type="button"
                onClick={() => handleDirectoryClick(dir)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <HugeiconsIcon
                  icon={Folder01Icon}
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <span className="readout truncate">{dir.name}</span>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
