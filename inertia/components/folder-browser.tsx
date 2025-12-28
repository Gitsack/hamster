import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
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
}

export function FolderBrowser({
  value,
  onChange,
  onCreateIfMissingChange,
  createIfMissing = false,
  className,
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
        setError(errorData.error || 'Failed to browse directory')
      }
    } catch {
      setError('Failed to browse directory')
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
        <Label>Path</Label>
        <Input
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          placeholder="/path/to/folder"
          className="font-mono text-sm"
        />
        {/* Path status indicator */}
        {inputValue && !checkingPath && pathStatus && (
          <div className="flex items-center gap-2 text-sm">
            {pathStatus.exists && pathStatus.isDirectory ? (
              <>
                <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4 text-green-600" />
                <span className="text-green-600">Path exists</span>
              </>
            ) : pathStatus.exists && !pathStatus.isDirectory ? (
              <>
                <HugeiconsIcon icon={Alert02Icon} className="size-4 text-destructive" />
                <span className="text-destructive">Path is not a directory</span>
              </>
            ) : (
              <>
                <HugeiconsIcon icon={Alert02Icon} className="size-4 text-amber-500" />
                <span className="text-amber-600">Path does not exist</span>
                {onCreateIfMissingChange && (
                  <div className="ml-auto flex items-center gap-2">
                    <Checkbox
                      id="createIfMissing"
                      checked={createIfMissing}
                      onCheckedChange={handleCreateIfMissingChange}
                    />
                    <Label htmlFor="createIfMissing" className="text-sm font-normal cursor-pointer">
                      Create folder
                    </Label>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Quick access buttons */}
      <div className="flex flex-wrap gap-1">
        {quickPaths.map((qp) => (
          <Button
            key={qp.path}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleQuickPath(qp.path)}
            className="h-7 text-xs"
          >
            {qp.name === 'Home' ? (
              <HugeiconsIcon icon={Home01Icon} className="mr-1 size-3" />
            ) : (
              <HugeiconsIcon icon={Folder01Icon} className="mr-1 size-3" />
            )}
            {qp.name}
          </Button>
        ))}
      </div>

      {/* Current path and navigation */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleGoUp}
          disabled={parentPath === null || loading}
          className="h-7 px-2"
        >
          <HugeiconsIcon icon={ArrowUp01Icon} className="mr-1 size-3" />
          Up
        </Button>
        <span className="flex-1 truncate font-mono text-xs">{currentPath || '/'}</span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleSelectCurrent}
          className="h-7"
        >
          Select This Folder
        </Button>
      </div>

      {/* Directory listing */}
      <ScrollArea className="h-48 rounded-md border">
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Loading...
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-sm text-destructive">
            {error}
          </div>
        ) : directories.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            No subdirectories
          </div>
        ) : (
          <div className="p-1">
            {directories.map((dir) => (
              <button
                key={dir.path}
                type="button"
                onClick={() => handleDirectoryClick(dir)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent text-left"
              >
                <HugeiconsIcon icon={Folder01Icon} className="size-4 text-muted-foreground" />
                <span className="truncate">{dir.name}</span>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
