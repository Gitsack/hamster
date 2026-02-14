import type { HttpContext } from '@adonisjs/core/http'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import RootFolder from '#models/root_folder'
import { accessWithTimeout, statWithTimeout } from '../utils/fs_utils.js'

interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
}

export default class FilesystemController {
  async browse({ request, response }: HttpContext) {
    const requestedPath = request.input('path', '')

    // Determine the path to browse
    let browsePath: string
    if (!requestedPath || requestedPath === '') {
      // Return root paths based on OS
      if (process.platform === 'win32') {
        // On Windows, list available drives
        const drives = await this.getWindowsDrives()
        return response.json({
          path: '',
          parent: null,
          directories: drives.map((drive) => ({
            name: drive,
            path: drive,
            isDirectory: true,
          })),
        })
      } else {
        // On Unix-like systems, start at root
        browsePath = '/'
      }
    } else {
      browsePath = requestedPath
    }

    // Normalize and resolve the path to prevent traversal attacks
    browsePath = path.resolve(path.normalize(browsePath))

    // Validate against path traversal
    if (browsePath.includes('\0')) {
      return response.forbidden({ error: 'Invalid path' })
    }

    try {
      // Check if path exists and is accessible (with timeout for network paths)
      const stats = await statWithTimeout(browsePath)
      if (!stats.isDirectory()) {
        return response.badRequest({ error: 'Path is not a directory' })
      }

      // Read directory contents
      const entries = await fs.readdir(browsePath, { withFileTypes: true })

      // Filter to only directories and sort alphabetically
      const directories: DirectoryEntry[] = entries
        .filter((entry) => {
          // Filter out hidden files/directories (starting with .)
          if (entry.name.startsWith('.')) return false
          // Only include directories
          return entry.isDirectory()
        })
        .map((entry) => ({
          name: entry.name,
          path: path.join(browsePath, entry.name),
          isDirectory: true,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))

      // Calculate parent path
      const parent = browsePath === '/' ? null : path.dirname(browsePath)

      return response.json({
        path: browsePath,
        parent,
        directories,
      })
    } catch (error) {
      return response.badRequest({
        error: 'Cannot access path',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  async quickPaths({ response }: HttpContext) {
    const paths: DirectoryEntry[] = []

    // Add configured root folders as quick paths
    const rootFolders = await RootFolder.all()
    for (const folder of rootFolders) {
      paths.push({
        name: `${folder.name} (${folder.mediaType})`,
        path: folder.path,
        isDirectory: true,
      })
    }

    // Add home directory
    const homeDir = os.homedir()
    paths.push({
      name: 'Home',
      path: homeDir,
      isDirectory: true,
    })

    // Add common directories
    const commonDirs = [
      { name: 'Documents', subpath: 'Documents' },
      { name: 'Downloads', subpath: 'Downloads' },
      { name: 'Music', subpath: 'Music' },
      { name: 'Movies', subpath: 'Movies' },
      { name: 'Pictures', subpath: 'Pictures' },
    ]

    for (const dir of commonDirs) {
      const fullPath = path.join(homeDir, dir.subpath)
      try {
        await accessWithTimeout(fullPath, 1000) // 1s timeout for quick paths
        paths.push({
          name: dir.name,
          path: fullPath,
          isDirectory: true,
        })
      } catch {
        // Directory doesn't exist or timed out, skip it
      }
    }

    // Add root on Unix systems
    if (process.platform !== 'win32') {
      paths.push({
        name: 'Root',
        path: '/',
        isDirectory: true,
      })
    }

    return response.json({ paths })
  }

  async checkPath({ request, response }: HttpContext) {
    const requestedPath = request.input('path', '')

    if (!requestedPath) {
      return response.badRequest({ error: 'Path is required' })
    }

    // Resolve to prevent traversal
    const resolvedPath = path.resolve(path.normalize(requestedPath))

    if (resolvedPath.includes('\0')) {
      return response.forbidden({ error: 'Invalid path' })
    }

    try {
      const stats = await statWithTimeout(resolvedPath)
      return response.json({
        exists: true,
        isDirectory: stats.isDirectory(),
        path: resolvedPath,
      })
    } catch {
      return response.json({
        exists: false,
        isDirectory: false,
        path: resolvedPath,
      })
    }
  }

  private async getWindowsDrives(): Promise<string[]> {
    // On Windows, we need to detect available drives
    const drives: string[] = []
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

    for (const letter of letters) {
      const drivePath = `${letter}:\\`
      try {
        await accessWithTimeout(drivePath, 500) // 500ms timeout per drive
        drives.push(drivePath)
      } catch {
        // Drive doesn't exist or isn't accessible
      }
    }

    return drives
  }
}
