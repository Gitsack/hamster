import { spawn } from 'node:child_process'
import { normalizeLanguageTag, type LanguageCode } from '#services/quality/language_parser'

/**
 * One audio stream, as the file describes itself.
 *
 * The rest of MediaAnalysis flattens a file to its first audio stream, which is
 * all a transcode decision needs. A language rule needs every stream: the whole
 * point of a dual-audio release is the track that is not first.
 */
export interface AudioTrackInfo {
  /** Stream index, so a future track selector can address it. */
  index: number
  codec: string | null
  channels: number | null
  channelLayout: string | null
  /** ISO 639-1, or null when the muxer never tagged the track. */
  language: LanguageCode | null
  /** The muxer's own label, e.g. "Commentary" or "Director's cut". */
  title: string | null
  isDefault: boolean
  profile: string | null
}

export interface MediaAnalysis {
  duration: number
  videoCodec: string | null
  videoWidth: number | null
  videoHeight: number | null
  videoBitrate: number | null
  audioCodec: string | null
  audioChannels: number | null
  audioBitrate: number | null
  audioSampleRate: number | null
  /**
   * ffprobe folds Atmos into TrueHD/E-AC3 and DTS:X / DTS-HD MA into "dts";
   * the stream profile is the only place the distinction survives, and it is
   * the difference between a reference track and a lossy one.
   */
  audioProfile: string | null
  audioChannelLayout: string | null
  /** Every audio stream, in file order. */
  audioTracks: AudioTrackInfo[]
  container: string
}

export interface TranscodeDecision {
  needsTranscode: boolean
  reason: string | null
  audioCodec: string | null
}

// Audio codecs that browsers can play natively
const BROWSER_COMPATIBLE_AUDIO = new Set([
  'aac',
  'mp3',
  'opus',
  'flac',
  'vorbis',
  'pcm_s16le',
  'pcm_s24le',
  'pcm_f32le',
])

// Audio codecs that definitely need transcoding
const NEEDS_TRANSCODE_AUDIO = new Set([
  'ac3',
  'eac3',
  'dts',
  'dts-hd',
  'truehd',
  'mlp',
  'dca', // DTS variant
])

/**
 * Check if ffmpeg and ffprobe are available on the system
 */
export async function checkFfmpegAvailable(): Promise<{ ffmpeg: boolean; ffprobe: boolean }> {
  const checkCommand = (cmd: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const proc = spawn(cmd, ['-version'])
      proc.on('error', () => resolve(false))
      proc.on('close', (code) => resolve(code === 0))
    })
  }

  const [ffmpeg, ffprobe] = await Promise.all([checkCommand('ffmpeg'), checkCommand('ffprobe')])

  return { ffmpeg, ffprobe }
}

/**
 * Probe a media file using ffprobe to get codec and format information
 */
export async function probeFile(filePath: string): Promise<MediaAnalysis> {
  return new Promise((resolve, reject) => {
    const args = ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filePath]

    const proc = spawn('ffprobe', args)
    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to run ffprobe: ${err.message}`))
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}: ${stderr}`))
        return
      }

      try {
        const data = JSON.parse(stdout)
        const format = data.format || {}
        const streams = data.streams || []

        // Find video and audio streams
        const videoStream = streams.find((s: any) => s.codec_type === 'video')
        const audioStreams = streams.filter((s: any) => s.codec_type === 'audio')
        const audioStream = audioStreams[0]

        const audioTracks: AudioTrackInfo[] = audioStreams.map((stream: any, order: number) => ({
          index: typeof stream.index === 'number' ? stream.index : order,
          codec: stream.codec_name || null,
          channels: stream.channels || null,
          channelLayout: stream.channel_layout || null,
          language: normalizeLanguageTag(stream.tags?.language ?? stream.tags?.LANGUAGE),
          title: stream.tags?.title || stream.tags?.TITLE || null,
          isDefault: stream.disposition?.default === 1,
          profile: stream.profile || null,
        }))

        const analysis: MediaAnalysis = {
          duration: Number.parseFloat(format.duration) || 0,
          container: format.format_name || 'unknown',
          videoCodec: videoStream?.codec_name || null,
          videoWidth: videoStream?.width || null,
          videoHeight: videoStream?.height || null,
          videoBitrate: videoStream?.bit_rate ? Number.parseInt(videoStream.bit_rate) : null,
          audioCodec: audioStream?.codec_name || null,
          audioChannels: audioStream?.channels || null,
          audioBitrate: audioStream?.bit_rate ? Number.parseInt(audioStream.bit_rate) : null,
          audioSampleRate: audioStream?.sample_rate
            ? Number.parseInt(audioStream.sample_rate)
            : null,
          audioProfile: audioStream?.profile || null,
          audioChannelLayout: audioStream?.channel_layout || null,
          audioTracks,
        }

        resolve(analysis)
      } catch (err) {
        reject(new Error(`Failed to parse ffprobe output: ${err}`))
      }
    })
  })
}

/**
 * Determine if a media file needs transcoding based on its audio codec
 */
export function needsTranscoding(audioCodec: string | null | undefined): TranscodeDecision {
  if (!audioCodec) {
    return {
      needsTranscode: false,
      reason: null,
      audioCodec: null,
    }
  }

  const codec = audioCodec.toLowerCase()

  // Check if it definitely needs transcoding
  if (NEEDS_TRANSCODE_AUDIO.has(codec)) {
    return {
      needsTranscode: true,
      reason: `Audio codec '${codec}' is not supported by browsers`,
      audioCodec: codec,
    }
  }

  // Check if it's browser-compatible
  if (BROWSER_COMPATIBLE_AUDIO.has(codec)) {
    return {
      needsTranscode: false,
      reason: null,
      audioCodec: codec,
    }
  }

  // Unknown codec - assume it needs transcoding to be safe
  return {
    needsTranscode: true,
    reason: `Unknown audio codec '${codec}' may not be supported by browsers`,
    audioCodec: codec,
  }
}

/**
 * Get the ffmpeg command arguments for transcoding a segment
 */
export function getSegmentTranscodeArgs(
  inputPath: string,
  startTime: number,
  segmentDuration: number
): string[] {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-ss',
    startTime.toString(),
    '-i',
    inputPath,
    '-t',
    segmentDuration.toString(),
    '-c:v',
    'copy', // Copy video stream (no re-encoding)
    '-c:a',
    'aac', // Transcode audio to AAC
    '-b:a',
    '192k', // Audio bitrate
    '-ac',
    '2', // Stereo output
    '-ar',
    '48000', // Sample rate
    '-f',
    'mpegts', // Output format for HLS segments
    '-mpegts_copyts',
    '1', // Preserve timestamps
    '-avoid_negative_ts',
    'make_zero',
    '-max_muxing_queue_size',
    '1024',
    'pipe:1', // Output to stdout
  ]
}

/**
 * Get ffmpeg args for generating all segments at once to a directory
 * This is more reliable than individual segment generation
 */
export function getHlsTranscodeArgs(
  inputPath: string,
  outputDir: string,
  segmentDuration: number = 6
): string[] {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    inputPath,
    '-c:v',
    'copy', // Copy video stream
    '-c:a',
    'aac', // Transcode audio to AAC
    '-b:a',
    '192k',
    '-ac',
    '2',
    '-ar',
    '48000',
    '-f',
    'hls',
    '-hls_time',
    segmentDuration.toString(),
    '-hls_list_size',
    '0', // Keep all segments in playlist
    '-hls_segment_type',
    'mpegts',
    '-hls_flags',
    'independent_segments+split_by_time',
    '-hls_segment_filename',
    `${outputDir}/segment-%d.ts`,
    `${outputDir}/master.m3u8`,
  ]
}

/**
 * Generate an HLS manifest (m3u8) for a video file
 */
export function generateHlsManifest(
  sessionId: string,
  duration: number,
  segmentDuration: number = 6
): string {
  const segmentCount = Math.ceil(duration / segmentDuration)

  let manifest = '#EXTM3U\n'
  manifest += '#EXT-X-VERSION:3\n'
  manifest += `#EXT-X-TARGETDURATION:${segmentDuration}\n`
  manifest += '#EXT-X-MEDIA-SEQUENCE:0\n'
  manifest += '#EXT-X-PLAYLIST-TYPE:VOD\n'

  for (let i = 0; i < segmentCount; i++) {
    const isLastSegment = i === segmentCount - 1
    const actualDuration = isLastSegment ? duration - i * segmentDuration : segmentDuration

    manifest += `#EXTINF:${actualDuration.toFixed(3)},\n`
    manifest += `/api/v1/playback/hls/${sessionId}/${i}.ts\n`
  }

  manifest += '#EXT-X-ENDLIST\n'

  return manifest
}
