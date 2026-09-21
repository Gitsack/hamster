import { spawn } from 'node:child_process'
import path from 'node:path'
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

/**
 * One subtitle stream, as the file describes itself.
 *
 * An embedded subtitle track and an external one are not the same thing to a
 * player. A server that transcodes has to hand each track over separately, and
 * some clients stop partway through a long list and give up on the whole
 * playback. Knowing how many tracks there are, and what language each carries,
 * is what lets the importer trim a release to the tracks someone here will read.
 */
export interface SubtitleTrackInfo {
  /** Stream index, in the form `-map 0:<index>` expects. */
  index: number
  codec: string | null
  /** ISO 639-1, or null when the muxer never tagged the track. */
  language: LanguageCode | null
  /** The muxer's own label, e.g. "SDH" or "Forced". */
  title: string | null
  isDefault: boolean
  /** Forced tracks carry signs and foreign dialogue, not the whole script. */
  isForced: boolean
  /** SDH tracks transcribe sound effects as well as dialogue. */
  isHearingImpaired: boolean
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
  /** Every subtitle stream, in file order. */
  subtitleTracks: SubtitleTrackInfo[]
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

        const subtitleStreams = streams.filter((s: any) => s.codec_type === 'subtitle')
        const subtitleTracks: SubtitleTrackInfo[] = subtitleStreams.map(
          (stream: any, order: number) => ({
            index: typeof stream.index === 'number' ? stream.index : order,
            codec: stream.codec_name || null,
            language: normalizeLanguageTag(stream.tags?.language ?? stream.tags?.LANGUAGE),
            title: stream.tags?.title || stream.tags?.TITLE || null,
            isDefault: stream.disposition?.default === 1,
            isForced: stream.disposition?.forced === 1,
            isHearingImpaired: stream.disposition?.hearing_impaired === 1,
          })
        )

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
          subtitleTracks,
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

/**
 * How aggressively to trim subtitle tracks at import.
 *
 * Off by default: throwing away tracks a release shipped with is not something
 * to do behind someone's back, and most files are nowhere near a size that
 * causes trouble.
 */
export interface SubtitlePruningOptions {
  enabled: boolean
  /** Files at or below this many tracks are left exactly as they are. */
  maxTracks: number
  /** ISO 639-1 codes to keep. Empty means "keep the first maxTracks, in file order". */
  keepLanguages: LanguageCode[]
}

export const defaultSubtitlePruningOptions: SubtitlePruningOptions = {
  enabled: false,
  maxTracks: 20,
  keepLanguages: [],
}

export interface SubtitleSelection {
  /** Stream indices to keep, in file order. */
  keep: number[]
  /** True when the file already satisfies the policy and must not be touched. */
  unchanged: boolean
  reason: string
}

/**
 * Decide which subtitle tracks survive.
 *
 * Kept separate from the remux so the policy can be reasoned about — and
 * tested — without an ffmpeg binary or a multi-gigabyte file anywhere near it.
 *
 * Two rules guard against a policy that deletes more than it should: a file at
 * or under the cap is never rewritten at all, and a language filter that would
 * match nothing falls back to file order rather than stripping every track.
 */
export function selectSubtitleTracksToKeep(
  tracks: SubtitleTrackInfo[],
  options: SubtitlePruningOptions
): SubtitleSelection {
  const all = tracks.map((track) => track.index)

  if (!options.enabled) {
    return { keep: all, unchanged: true, reason: 'pruning disabled' }
  }

  const maxTracks = Math.max(1, Math.floor(options.maxTracks))

  if (tracks.length <= maxTracks) {
    return {
      keep: all,
      unchanged: true,
      reason: `${tracks.length} track(s) is within the limit of ${maxTracks}`,
    }
  }

  let chosen: SubtitleTrackInfo[] = []
  let reason = ''

  if (options.keepLanguages.length > 0) {
    const wanted = new Set(options.keepLanguages)
    // Untagged tracks are kept on purpose: a null language is usually a forced
    // signs track, and there is no way to tell it apart from one worth losing.
    chosen = tracks.filter((track) => track.language === null || wanted.has(track.language))
    reason = `kept ${options.keepLanguages.join(', ')} and untagged tracks`
  }

  if (chosen.length === 0) {
    chosen = tracks.slice(0, maxTracks)
    reason =
      options.keepLanguages.length > 0
        ? `no track matched ${options.keepLanguages.join(', ')}; kept the first ${chosen.length} in file order`
        : `kept the first ${chosen.length} in file order`
  } else if (chosen.length > maxTracks) {
    chosen = chosen.slice(0, maxTracks)
    reason += `, truncated to ${maxTracks}`
  }

  return {
    keep: chosen.map((track) => track.index),
    unchanged: chosen.length === tracks.length,
    reason,
  }
}

/**
 * ffmpeg arguments that copy a file while keeping only the given subtitle
 * streams. Every stream is copied, never re-encoded: video and audio come out
 * bit-identical and the whole thing is bound by disk speed, not CPU.
 */
export function getSubtitlePruneArgs(
  inputPath: string,
  outputPath: string,
  keepSubtitleIndices: number[]
): string[] {
  const args = ['-nostdin', '-v', 'error', '-y', '-i', inputPath, '-map', '0:v', '-map', '0:a']
  for (const index of keepSubtitleIndices) {
    args.push('-map', `0:${index}`)
  }
  args.push('-c', 'copy', outputPath)
  return args
}

/**
 * Subtitle codecs that have a standalone text form, and what to write them as.
 *
 * Image-based tracks — PGS on a Blu-ray remux, VobSub on a DVD rip — are
 * deliberately absent. There is no text to extract, only pictures, and the only
 * ways to get them onto a screen are to hand the client the whole container or
 * to burn them into the video. Neither is something an importer should decide.
 */
const SIDECAR_SUBTITLE_FORMATS: Record<string, { extension: string; encoder: string }> = {
  subrip: { extension: '.srt', encoder: 'copy' },
  srt: { extension: '.srt', encoder: 'copy' },
  ass: { extension: '.ass', encoder: 'copy' },
  ssa: { extension: '.ass', encoder: 'copy' },
  webvtt: { extension: '.vtt', encoder: 'copy' },
  // Timed text in an MP4. Nothing reads it as a sidecar, so it becomes SRT.
  mov_text: { extension: '.srt', encoder: 'srt' },
  text: { extension: '.srt', encoder: 'srt' },
}

/**
 * Plenty of releases label a track only in its title and never set the
 * disposition bit ffprobe reports — "SDH" in the name, nothing in the flags.
 * Reading both is what keeps two English tracks from coming out as a pair of
 * names that say nothing about which is which.
 */
function isHearingImpaired(track: SubtitleTrackInfo): boolean {
  return track.isHearingImpaired || /\b(sdh|cc|hearing[\s-]?impaired)\b/i.test(track.title ?? '')
}

function isForced(track: SubtitleTrackInfo): boolean {
  return track.isForced || /\b(forced|signs?)\b/i.test(track.title ?? '')
}

export interface SubtitleSidecar {
  /** Stream index, in the form `-map 0:<index>` expects. */
  index: number
  /** File name only; the caller decides which directory it lands in. */
  fileName: string
  /** ffmpeg `-c:s` value — `copy` whenever the track is already in that format. */
  encoder: string
}

/**
 * Work out which subtitle tracks can be written beside the video, and what to
 * call each one.
 *
 * The names follow the convention every media server already understands:
 * `<video name>.<language>[.forced][.sdh].<ext>`. A server that finds those
 * reads a few kilobytes off disk when someone turns subtitles on. A server that
 * does not has to demux the track out of the container instead, which means
 * reading the entire file — minutes, over a network share, with the person
 * staring at a black screen while it happens.
 *
 * Pure on purpose: the naming is the part worth testing, and it needs neither
 * ffmpeg nor a multi-gigabyte file to exercise.
 */
export function planSubtitleSidecars(
  tracks: SubtitleTrackInfo[],
  videoFileName: string
): SubtitleSidecar[] {
  const base = videoFileName.replace(/\.[^.]+$/, '')
  const sidecars: SubtitleSidecar[] = []
  const taken = new Set<string>()

  for (const track of tracks) {
    const format = SIDECAR_SUBTITLE_FORMATS[track.codec?.toLowerCase() ?? '']
    if (!format) {
      continue
    }

    // "und" rather than nothing: a name with no language token at all reads as
    // part of the title, and the track shows up unlabelled.
    const parts = [base, track.language ?? 'und']
    if (isForced(track)) {
      parts.push('forced')
    }
    if (isHearingImpaired(track)) {
      parts.push('sdh')
    }
    if (track.isDefault) {
      parts.push('default')
    }

    // Two English tracks with identical flags are common — a plain one and a
    // commentary, say. The stream index is the only thing guaranteed to differ.
    let fileName = parts.join('.') + format.extension
    if (taken.has(fileName)) {
      fileName = [...parts, track.index].join('.') + format.extension
    }
    taken.add(fileName)

    sidecars.push({ index: track.index, fileName, encoder: format.encoder })
  }

  return sidecars
}

/**
 * ffmpeg arguments that write every planned sidecar in one pass.
 *
 * One pass matters more than it looks: each output is cheap, but the input is
 * read from start to finish because subtitle packets are interleaved through
 * the whole container. Extracting five tracks in five invocations reads the
 * file five times.
 */
export function getSubtitleExtractArgs(
  inputPath: string,
  sidecars: SubtitleSidecar[],
  outputDir: string
): string[] {
  const args = ['-nostdin', '-v', 'error', '-y', '-i', inputPath]

  for (const sidecar of sidecars) {
    args.push(
      '-map',
      `0:${sidecar.index}`,
      '-an',
      '-vn',
      '-c:s',
      sidecar.encoder,
      path.join(outputDir, sidecar.fileName)
    )
  }

  return args
}
