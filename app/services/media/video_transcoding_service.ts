import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  probeFile,
  needsTranscoding,
  type MediaAnalysis,
} from '#utils/ffmpeg_utils'

const TEMP_BASE_DIR = '/tmp/hamster-transcode'
const SEGMENT_DURATION = 6 // seconds
const SESSION_TIMEOUT = 10 * 60 * 1000 // 10 minutes
const CLEANUP_INTERVAL = 60 * 1000 // 1 minute

// Transcoding settings (can be updated from app settings)
export interface TranscodingSettings {
  useHardwareAcceleration: boolean
  hardwareAccelType: 'auto' | 'videotoolbox' | 'cuda' | 'qsv' | 'vaapi' | 'none'
}

let transcodingSettings: TranscodingSettings = {
  useHardwareAcceleration: false,
  hardwareAccelType: 'auto',
}

export function updateTranscodingSettings(settings: Partial<TranscodingSettings>): void {
  transcodingSettings = { ...transcodingSettings, ...settings }
  console.log('[Transcoding] Settings updated:', transcodingSettings)
}

export function getTranscodingSettings(): TranscodingSettings {
  return { ...transcodingSettings }
}

// Hardware acceleration detection
type HwAccelType = 'videotoolbox' | 'cuda' | 'qsv' | 'vaapi' | null
let detectedHwAccel: HwAccelType | undefined = undefined

async function detectHardwareAcceleration(): Promise<HwAccelType> {
  if (detectedHwAccel !== undefined) {
    return detectedHwAccel
  }

  const { execSync } = await import('node:child_process')

  try {
    const output = execSync('ffmpeg -hide_banner -hwaccels', { encoding: 'utf-8', timeout: 5000 })
    const hwaccels = output.toLowerCase()

    if (hwaccels.includes('videotoolbox')) {
      detectedHwAccel = 'videotoolbox'
    } else if (hwaccels.includes('cuda')) {
      detectedHwAccel = 'cuda'
    } else if (hwaccels.includes('qsv')) {
      detectedHwAccel = 'qsv'
    } else if (hwaccels.includes('vaapi')) {
      detectedHwAccel = 'vaapi'
    } else {
      detectedHwAccel = null
    }
    console.log('[Transcoding] Detected hardware acceleration:', detectedHwAccel || 'none')
  } catch {
    detectedHwAccel = null
  }

  return detectedHwAccel
}

function getHwAccelArgs(): string[] {
  if (!transcodingSettings.useHardwareAcceleration) {
    return []
  }

  const hwType = transcodingSettings.hardwareAccelType === 'auto'
    ? detectedHwAccel
    : transcodingSettings.hardwareAccelType === 'none'
      ? null
      : transcodingSettings.hardwareAccelType

  if (!hwType) return []

  switch (hwType) {
    case 'videotoolbox':
      return ['-hwaccel', 'videotoolbox']
    case 'cuda':
      return ['-hwaccel', 'cuda']
    case 'qsv':
      return ['-hwaccel', 'qsv']
    case 'vaapi':
      return ['-hwaccel', 'vaapi', '-hwaccel_device', '/dev/dri/renderD128']
    default:
      return []
  }
}

export interface TranscodingSession {
  id: string
  filePath: string
  mediaFileId: string
  mediaType: 'movie' | 'episode'
  duration: number
  audioCodec: string | null
  segmentDuration: number
  sessionDir: string
  createdAt: Date
  lastAccessedAt: Date
  ffmpegProcess: ChildProcess | null
  ready: boolean
  error: string | null
  isRestarting: boolean // Flag to prevent concurrent restarts
  currentStartSegment: number // Track where transcoding started from
}

export interface PlaybackInfo {
  needsTranscode: boolean
  transcodeReason: string | null
  playbackUrl: string
  duration: number
  audioCodec: string | null
}

class VideoTranscodingService {
  private sessions: Map<string, TranscodingSession> = new Map()
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor() {
    this.startCleanupTimer()
    this.ensureTempDir()
  }

  private ensureTempDir(): void {
    if (!fs.existsSync(TEMP_BASE_DIR)) {
      fs.mkdirSync(TEMP_BASE_DIR, { recursive: true })
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupStaleSessions()
    }, CLEANUP_INTERVAL)
  }

  private cleanupStaleSessions(): void {
    const now = Date.now()
    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastAccessedAt.getTime() > SESSION_TIMEOUT) {
        this.destroySession(sessionId)
      }
    }
  }

  /**
   * Get playback info for a video file - determines if transcoding is needed
   */
  async getPlaybackInfo(
    filePath: string,
    mediaFileId: string,
    mediaType: 'movie' | 'episode'
  ): Promise<PlaybackInfo> {
    // Probe the file to get codec info
    let analysis: MediaAnalysis
    try {
      analysis = await probeFile(filePath)
    } catch (error) {
      // If probing fails, assume direct play and let browser handle it
      console.error('Failed to probe file:', error)
      return {
        needsTranscode: false,
        transcodeReason: null,
        playbackUrl: `/api/v1/playback/${mediaType}/${mediaFileId}`,
        duration: 0,
        audioCodec: null,
      }
    }

    const transcodeDecision = needsTranscoding(analysis.audioCodec)

    if (!transcodeDecision.needsTranscode) {
      // Direct playback
      return {
        needsTranscode: false,
        transcodeReason: null,
        playbackUrl: `/api/v1/playback/${mediaType}/${mediaFileId}`,
        duration: analysis.duration,
        audioCodec: analysis.audioCodec,
      }
    }

    // Need to transcode - create or get existing session
    let session = this.findExistingSession(mediaFileId)
    if (!session) {
      session = await this.createSession(filePath, mediaFileId, mediaType, analysis)
    } else {
      session.lastAccessedAt = new Date()
    }

    // Wait for the session to be ready (manifest generated)
    await this.waitForSessionReady(session)

    if (session.error) {
      throw new Error(session.error)
    }

    return {
      needsTranscode: true,
      transcodeReason: transcodeDecision.reason,
      playbackUrl: `/api/v1/playback/hls/${session.id}/master.m3u8`,
      duration: analysis.duration,
      audioCodec: analysis.audioCodec,
    }
  }

  private findExistingSession(mediaFileId: string): TranscodingSession | null {
    for (const session of this.sessions.values()) {
      if (session.mediaFileId === mediaFileId) {
        return session
      }
    }
    return null
  }

  private async createSession(
    filePath: string,
    mediaFileId: string,
    mediaType: 'movie' | 'episode',
    analysis: MediaAnalysis
  ): Promise<TranscodingSession> {
    const sessionId = randomUUID()
    const sessionDir = path.join(TEMP_BASE_DIR, `session-${sessionId}`)

    fs.mkdirSync(sessionDir, { recursive: true })

    const session: TranscodingSession = {
      id: sessionId,
      filePath,
      mediaFileId,
      mediaType,
      duration: analysis.duration,
      audioCodec: analysis.audioCodec,
      segmentDuration: SEGMENT_DURATION,
      sessionDir,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      ffmpegProcess: null,
      ready: false,
      error: null,
      isRestarting: false,
      currentStartSegment: 0,
    }

    this.sessions.set(sessionId, session)

    // Start ffmpeg transcoding in background (don't await)
    void this.startTranscoding(session)

    return session
  }

  private async startTranscoding(session: TranscodingSession): Promise<void> {
    const outputPath = path.join(session.sessionDir, 'master.m3u8')
    const segmentPattern = path.join(session.sessionDir, 'segment-%d.ts')

    // Detect hardware acceleration
    await detectHardwareAcceleration()
    const hwAccelArgs = getHwAccelArgs()

    const args = [
      '-hide_banner',
      '-loglevel', 'warning',
      // Hardware acceleration (if enabled)
      ...hwAccelArgs,
      '-i', session.filePath,
      // Use multiple threads for audio encoding
      '-threads', '0',
      // Copy video stream (no re-encoding)
      '-c:v', 'copy',
      // Transcode audio to AAC
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ac', '2',
      '-ar', '48000',
      // Timestamp handling
      '-avoid_negative_ts', 'make_zero',
      '-max_muxing_queue_size', '4096',
      // HLS output
      '-f', 'hls',
      '-hls_time', session.segmentDuration.toString(),
      '-hls_list_size', '0', // Keep all segments in playlist
      '-hls_segment_type', 'mpegts',
      '-hls_flags', 'independent_segments',
      '-hls_segment_filename', segmentPattern,
      '-start_number', '0',
      outputPath,
    ]

    const hwInfo = hwAccelArgs.length > 0 ? ` (hw: ${hwAccelArgs[1]})` : ''
    console.log(`Starting transcode for session ${session.id}${hwInfo}`)

    const proc = spawn('ffmpeg', args)
    session.ffmpegProcess = proc

    let stderr = ''

    proc.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('error', (err) => {
      console.error(`FFmpeg process error for session ${session.id}:`, err)
      session.error = `FFmpeg error: ${err.message}`
      session.ready = true // Mark as ready so waiters stop waiting
    })

    proc.on('close', (code) => {
      if (code !== 0 && !session.ready) {
        console.error(`FFmpeg exited with code ${code} for session ${session.id}:`, stderr)
        session.error = `FFmpeg exited with code ${code}`
      }
      session.ffmpegProcess = null
      console.log(`Transcode completed for session ${session.id}`)
    })

    // Check for manifest file to mark session as ready
    this.watchForManifest(session, outputPath)
  }

  private watchForManifest(session: TranscodingSession, manifestPath: string): void {
    const checkInterval = 100 // ms
    const maxWait = 30000 // 30 seconds

    let waited = 0
    const check = () => {
      if (session.error) {
        return // Error occurred, stop checking
      }

      if (fs.existsSync(manifestPath)) {
        // Check if manifest has at least one segment listed
        try {
          const content = fs.readFileSync(manifestPath, 'utf-8')
          if (content.includes('.ts')) {
            session.ready = true
            console.log(`Session ${session.id} is ready`)
            return
          }
        } catch {
          // File might still be writing, continue waiting
        }
      }

      waited += checkInterval
      if (waited >= maxWait) {
        session.error = 'Timeout waiting for transcode to start'
        session.ready = true
        return
      }

      setTimeout(check, checkInterval)
    }

    check()
  }

  private async waitForSessionReady(session: TranscodingSession): Promise<void> {
    const maxWait = 35000 // slightly longer than manifest watch timeout
    const pollInterval = 100
    let waited = 0

    while (!session.ready && waited < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval))
      waited += pollInterval
    }

    if (!session.ready) {
      throw new Error('Timeout waiting for transcoding session to be ready')
    }
  }

  /**
   * Get the HLS manifest for a session
   * Generates a complete manifest based on video duration, not ffmpeg progress
   */
  getManifest(sessionId: string): string | null {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return null
    }

    session.lastAccessedAt = new Date()

    // Generate a complete manifest based on known duration
    // This allows seeking to any point, even if segments aren't generated yet
    const segmentCount = Math.ceil(session.duration / session.segmentDuration)

    let manifest = '#EXTM3U\n'
    manifest += '#EXT-X-VERSION:3\n'
    manifest += `#EXT-X-TARGETDURATION:${session.segmentDuration}\n`
    manifest += '#EXT-X-MEDIA-SEQUENCE:0\n'
    manifest += '#EXT-X-PLAYLIST-TYPE:VOD\n'

    for (let i = 0; i < segmentCount; i++) {
      const isLastSegment = i === segmentCount - 1
      const segmentDuration = isLastSegment
        ? session.duration - (i * session.segmentDuration)
        : session.segmentDuration

      manifest += `#EXTINF:${segmentDuration.toFixed(3)},\n`
      manifest += `/api/v1/playback/hls/${sessionId}/${i}.ts\n`
    }

    manifest += '#EXT-X-ENDLIST\n'

    return manifest
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): TranscodingSession | null {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.lastAccessedAt = new Date()
    }
    return session || null
  }

  /**
   * Get a segment from a session
   * If seeking far ahead, restarts transcoding from that point
   */
  async getSegment(sessionId: string, segmentIndex: number): Promise<Buffer | null> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      console.log(`getSegment: Session ${sessionId} not found`)
      return null
    }

    session.lastAccessedAt = new Date()

    const segmentPath = path.join(session.sessionDir, `segment-${segmentIndex}.ts`)

    // If segment already exists and has non-zero size, return it immediately
    if (fs.existsSync(segmentPath)) {
      const stats = fs.statSync(segmentPath)
      if (stats.size > 0) {
        // Wait a bit to ensure file is fully written
        await new Promise((resolve) => setTimeout(resolve, 50))
        try {
          return fs.readFileSync(segmentPath)
        } catch {
          // File might have been deleted, continue to wait/regenerate
        }
      }
    }

    // Check if we need to restart transcoding
    // Only restart if the segment is far ahead of what we're currently transcoding
    const shouldRestart = !session.isRestarting &&
      (segmentIndex < session.currentStartSegment || // Seeking backwards
       segmentIndex > session.currentStartSegment + 10) // Seeking far ahead

    if (shouldRestart) {
      // Check what's the highest segment we actually have
      let highestExistingSegment = -1
      for (let i = Math.min(segmentIndex + 5, Math.ceil(session.duration / session.segmentDuration)); i >= 0; i--) {
        const checkPath = path.join(session.sessionDir, `segment-${i}.ts`)
        if (fs.existsSync(checkPath)) {
          const stats = fs.statSync(checkPath)
          if (stats.size > 0) {
            highestExistingSegment = i
            break
          }
        }
      }

      // Only restart if the segment doesn't exist and is far from current progress
      if (!fs.existsSync(segmentPath) &&
          (segmentIndex < session.currentStartSegment - 2 ||
           segmentIndex > highestExistingSegment + 3)) {
        const seekTime = segmentIndex * session.segmentDuration
        console.log(`Seeking to segment ${segmentIndex} (time: ${seekTime}s), highest existing: ${highestExistingSegment}, current start: ${session.currentStartSegment}`)
        await this.restartTranscodingFromPosition(session, segmentIndex)
      }
    }

    // Wait for the segment to be generated
    const maxWait = 60000 // 60 seconds max wait
    const pollInterval = 200
    let waited = 0

    while (waited < maxWait) {
      // Check if segment exists and has content
      if (fs.existsSync(segmentPath)) {
        try {
          const stats = fs.statSync(segmentPath)
          if (stats.size > 0) {
            // Wait a bit more to ensure file is fully written
            await new Promise((resolve) => setTimeout(resolve, 100))
            return fs.readFileSync(segmentPath)
          }
        } catch {
          // File might be in process of being written
        }
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval))
      waited += pollInterval

      // Check for errors
      if (session.error) {
        console.error(`Session error while waiting for segment ${segmentIndex}: ${session.error}`)
        // Clear error and try to continue
        session.error = null
        break
      }

      // Log progress every 3 seconds
      if (waited % 3000 === 0) {
        console.log(`Waiting for segment ${segmentIndex}... (${waited / 1000}s elapsed, ffmpeg running: ${session.ffmpegProcess !== null})`)
      }
    }

    // Final check
    if (fs.existsSync(segmentPath)) {
      try {
        const stats = fs.statSync(segmentPath)
        if (stats.size > 0) {
          return fs.readFileSync(segmentPath)
        }
      } catch {
        // Fall through to error
      }
    }

    console.error(`Timeout waiting for segment ${segmentIndex} after ${waited}ms`)
    return null
  }

  /**
   * Restart transcoding from a specific segment position (for seeking)
   */
  private async restartTranscodingFromPosition(session: TranscodingSession, startSegment: number): Promise<void> {
    // Mark as restarting to prevent concurrent restarts
    session.isRestarting = true
    session.error = null // Clear any previous error

    // Kill existing ffmpeg process and wait for it to die
    if (session.ffmpegProcess) {
      const oldProcess = session.ffmpegProcess
      session.ffmpegProcess = null

      // Try SIGTERM first, then SIGKILL
      oldProcess.kill('SIGTERM')

      // Wait for process to exit (max 2 seconds)
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          oldProcess.kill('SIGKILL')
          resolve()
        }, 2000)

        oldProcess.on('close', () => {
          clearTimeout(timeout)
          resolve()
        })
      })

      // Small delay to ensure file handles are released
      await new Promise((resolve) => setTimeout(resolve, 50))
    }

    const startTime = startSegment * session.segmentDuration
    const segmentPattern = path.join(session.sessionDir, 'segment-%d.ts')
    // Output to a temp manifest (we use our own generated manifest)
    const outputPath = path.join(session.sessionDir, 'seek.m3u8')

    // Update current start segment
    session.currentStartSegment = startSegment

    // Detect hardware acceleration
    await detectHardwareAcceleration()
    const hwAccelArgs = getHwAccelArgs()

    // Use fast seeking (-ss before -i) with proper timestamp handling
    const args = [
      '-hide_banner',
      '-loglevel', 'warning',
      // Hardware acceleration (if enabled)
      ...hwAccelArgs,
      // Fast seek - before input
      '-ss', startTime.toString(),
      '-i', session.filePath,
      // Use multiple threads for audio encoding
      '-threads', '0',
      // Copy video stream
      '-c:v', 'copy',
      // Transcode audio to AAC
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ac', '2',
      '-ar', '48000',
      // Timestamp handling
      '-avoid_negative_ts', 'make_zero',
      '-max_muxing_queue_size', '4096',
      // HLS output
      '-f', 'hls',
      '-hls_time', session.segmentDuration.toString(),
      '-hls_list_size', '0',
      '-hls_segment_type', 'mpegts',
      '-hls_flags', 'independent_segments',
      '-hls_segment_filename', segmentPattern,
      '-start_number', startSegment.toString(),
      outputPath,
    ]

    const hwInfo = hwAccelArgs.length > 0 ? ` (hw: ${hwAccelArgs[1]})` : ''
    console.log(`Restarting transcode from segment ${startSegment} (time: ${startTime}s)${hwInfo}`)

    const proc = spawn('ffmpeg', args)
    session.ffmpegProcess = proc

    let stderrBuffer = ''

    proc.stderr?.on('data', (data) => {
      stderrBuffer += data.toString()
      // Log errors immediately
      const msg = data.toString()
      if (msg.includes('Error') || msg.includes('error') || msg.includes('Invalid')) {
        console.error(`FFmpeg stderr: ${msg}`)
      }
    })

    proc.on('error', (err) => {
      console.error(`FFmpeg process error:`, err)
      session.error = `FFmpeg error: ${err.message}`
    })

    proc.on('close', (code) => {
      if (session.ffmpegProcess === proc) {
        session.ffmpegProcess = null
      }

      if (code !== 0 && code !== null) {
        console.error(`FFmpeg exited with code ${code}`)
        console.error(`FFmpeg stderr output: ${stderrBuffer}`)
        if (!session.error) {
          session.error = `FFmpeg exited with code ${code}`
        }
      } else {
        console.log(`FFmpeg seek transcode completed successfully for session ${session.id}`)
      }
    })

    // Wait briefly for ffmpeg to start
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Clear isRestarting flag now that process has started
    session.isRestarting = false

    // Check if process is still running
    if (!session.ffmpegProcess) {
      console.error('FFmpeg process exited immediately after starting')
    } else {
      console.log('FFmpeg process started successfully, waiting for first segment...')
    }
  }

  /**
   * Destroy a session and clean up its files
   */
  destroySession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return false
    }

    // Kill ffmpeg process if running
    if (session.ffmpegProcess) {
      session.ffmpegProcess.kill('SIGTERM')
      session.ffmpegProcess = null
    }

    // Remove temp directory
    try {
      if (fs.existsSync(session.sessionDir)) {
        fs.rmSync(session.sessionDir, { recursive: true })
      }
    } catch (error) {
      console.error(`Failed to clean up session directory: ${error}`)
    }

    this.sessions.delete(sessionId)
    console.log(`Destroyed session ${sessionId}`)
    return true
  }

  /**
   * Clean up all sessions (for shutdown)
   */
  cleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    for (const sessionId of this.sessions.keys()) {
      this.destroySession(sessionId)
    }

    // Clean up the base temp directory
    try {
      if (fs.existsSync(TEMP_BASE_DIR)) {
        fs.rmSync(TEMP_BASE_DIR, { recursive: true })
      }
    } catch (error) {
      console.error(`Failed to clean up temp directory: ${error}`)
    }
  }

  /**
   * Get stats about active sessions
   */
  getStats(): { activeSessions: number; sessionIds: string[] } {
    return {
      activeSessions: this.sessions.size,
      sessionIds: Array.from(this.sessions.keys()),
    }
  }
}

// Export singleton instance
export const videoTranscodingService = new VideoTranscodingService()
