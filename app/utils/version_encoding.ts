import type { MediaAnalysis, SubtitleTrackInfo } from '#utils/ffmpeg_utils'
import type { VersionAudioMode, VersionQuality } from '#models/version_profile'

/**
 * How a version gets encoded.
 *
 * - `vaapi`: the GPU decodes and encodes; nothing but the compressed stream
 *   crosses into system memory. Several times faster than the CPU.
 * - `vaapi-upload`: the CPU decodes and the GPU encodes. For sources the GPU
 *   cannot decode (MPEG-4 ASP, some odd profiles).
 * - `x265`: all on the CPU. Slow, but runs anywhere ffmpeg does.
 */
export type VersionEncoder = 'vaapi' | 'vaapi-upload' | 'x265'

export interface VersionEncodeProfile {
  maxHeight: number
  quality: VersionQuality
  audio: VersionAudioMode
  subtitles: boolean
}

/** A subtitle file beside the source, e.g. `Movie (2020).en.forced.srt`. */
export interface SubtitleSidecarInput {
  path: string
  language: string | null
  forced: boolean
  hearingImpaired: boolean
}

export interface VersionEncodeInput {
  sourcePath: string
  outputPath: string
  analysis: MediaAnalysis
  profile: VersionEncodeProfile
  encoder: VersionEncoder
  /** Stream indices of the embedded subtitle tracks to carry over. */
  subtitleIndices: number[]
  /** Subtitle files beside the source, for tracks the import moved out of it. */
  sidecars?: SubtitleSidecarInput[]
  vaapiDevice?: string
  /**
   * ICQ where the driver has it. Older Intel drivers (Ubuntu 24.04's
   * intel-media 24.1) only offer CQP, CBR, VBR and QVBR.
   */
  vaapiRateControl?: VaapiRateControl
}

export type VaapiRateControl = 'ICQ' | 'CQP'

/**
 * Constant QP carries no adaptive quantisation, so it needs a slightly higher
 * number to land on the same size as ICQ: QP 25 matched ICQ 23 on the
 * reference clip within a few percent.
 */
const CQP_OFFSET = 2

/**
 * Quality levels per encoder, kept separate because the GPU's ICQ value and
 * x265's CRF are different scales that happen to line up here.
 *
 * Measured on a 1080p Blu-ray clip (Intel Iris Xe, VMAF against the source,
 * sizes scaled to a two-hour film):
 *
 *   GPU ICQ 22  3.4 GB  VMAF 96.3  180 fps      x265 CRF 22  3.5 GB  96.2  28 fps
 *   GPU ICQ 25  1.8 GB  VMAF 93.9  200 fps      x265 CRF 24  2.2 GB  94.9  31 fps
 *                                               x265 CRF 26  1.5 GB  93.2  36 fps
 *
 * Same size for the same picture, six times faster on the GPU. x265's "slow"
 * preset bought 2 VMAF points at 8 fps — six hours a film — so it is not
 * offered. "Balanced" sits near VMAF 95, where a phone or tablet screen stops
 * showing a difference. Grainy films come out larger, clean digital ones
 * (most 4K HDR) about half this.
 */
const QUALITY_VALUES: Record<VersionQuality, { vaapi: number; x265: number }> = {
  high: { vaapi: 21, x265: 21 },
  balanced: { vaapi: 23, x265: 23 },
  small: { vaapi: 25, x265: 25 },
}

/** Sources taller than this are resized on the GPU, despite its flush bug. */
const GPU_SCALE_ABOVE = 1200

/**
 * Whether a failed GPU encode only lost its last frames to ffmpeg 6.1's
 * scaler flush bug, which reads "Out of memory" in Alpine's build and
 * "Cannot allocate memory" in Ubuntu's. The file is finalised either way; the
 * duration check afterwards decides whether it is complete enough to keep.
 */
export function encodeStoppedAtFlush(stderr: string, percent: number): boolean {
  return (
    percent > 97 && /Error while filtering: (Out of memory|Cannot allocate memory)/.test(stderr)
  )
}

const HDR_TRANSFERS = new Set(['smpte2084', 'arib-std-b67'])

/** Subtitle codecs a Matroska file can carry as they are. */
const MKV_SUBTITLE_COPY = new Set([
  'subrip',
  'srt',
  'ass',
  'ssa',
  'webvtt',
  'hdmv_pgs_subtitle',
  'dvd_subtitle',
  'dvb_subtitle',
])

/** Subtitle codecs that have to be converted to go into Matroska. */
const MKV_SUBTITLE_CONVERT: Record<string, string> = {
  mov_text: 'srt',
}

export function isHdr(analysis: MediaAnalysis): boolean {
  return HDR_TRANSFERS.has(analysis.videoColorTransfer ?? '')
}

export function isHighBitDepth(analysis: MediaAnalysis): boolean {
  return /p1[02]/.test(analysis.videoPixFmt ?? '') || isHdr(analysis)
}

/**
 * Why a source cannot be made into a version, or null when it can.
 */
export function unsupportedSourceReason(analysis: MediaAnalysis): string | null {
  if (!analysis.videoCodec || !analysis.videoWidth || !analysis.videoHeight) {
    return 'the source has no video stream'
  }
  // Profile 5 has no HDR10 base layer: the picture is only right after
  // Dolby Vision processing, which a re-encode drops. The result would play
  // with green and purple faces. Profiles 7 and 8 carry HDR10 underneath and
  // come out as plain HDR10.
  if (analysis.dolbyVisionProfile === 5) {
    return 'Dolby Vision profile 5 has no HDR10 fallback to encode from'
  }
  return null
}

/**
 * Output size that fits within `maxHeight` and the matching 16:9 width, so a
 * 3840×1600 scope film scales to 1920×800 rather than 2592×1080. Never
 * upscales. Both sides stay even, which 4:2:0 video requires.
 */
export function targetDimensions(
  width: number,
  height: number,
  maxHeight: number
): { width: number; height: number; scaled: boolean } {
  const maxWidth = Math.round((maxHeight * 16) / 9)
  const factor = Math.min(1, maxWidth / width, maxHeight / height)
  if (factor >= 1) {
    return { width, height, scaled: false }
  }
  const even = (value: number) => Math.max(2, Math.round(value / 2) * 2)
  return { width: even(width * factor), height: even(height * factor), scaled: true }
}

/**
 * Audio tracks worth keeping: one per language, and no commentary unless
 * commentary is all there is. A Blu-ray's TrueHD 7.1 and its E-AC-3 5.1
 * core come out as the same stereo track once downmixed, and each costs
 * 100–200 MB in the copy. Of several in a language, the one with the most
 * channels is kept — the best to downmix or keep as surround.
 */
export function selectAudioTracks(analysis: MediaAnalysis): number[] {
  const tracks = analysis.audioTracks
  const main = tracks.filter((track) => !/comment/i.test(track.title ?? ''))
  const candidates = main.length > 0 ? main : tracks

  const best = new Map<string, (typeof candidates)[number]>()
  for (const track of candidates) {
    const key = track.language ?? 'und'
    const current = best.get(key)
    if (!current || (track.channels ?? 0) > (current.channels ?? 0)) best.set(key, track)
  }
  const keep = new Set([...best.values()].map((track) => track.index))
  return candidates.filter((track) => keep.has(track.index)).map((track) => track.index)
}

function subtitleCodecArgs(track: SubtitleTrackInfo | undefined): string | null {
  const codec = track?.codec?.toLowerCase() ?? ''
  if (MKV_SUBTITLE_COPY.has(codec)) return 'copy'
  return MKV_SUBTITLE_CONVERT[codec] ?? null
}

/**
 * Subtitle tracks from `indices` that can go into the output at all.
 */
export function usableSubtitleIndices(analysis: MediaAnalysis, indices: number[]): number[] {
  const byIndex = new Map(analysis.subtitleTracks.map((track) => [track.index, track]))
  return indices.filter((index) => subtitleCodecArgs(byIndex.get(index)) !== null)
}

/**
 * Parse a sidecar file name written by the import, `<base>.<lang>[.forced]
 * [.sdh][.default][.<n>].<ext>`, back into what it describes. Null when the
 * name does not belong to `videoBase` or is not a text subtitle.
 */
export function parseSidecarName(
  fileName: string,
  videoBase: string
): Omit<SubtitleSidecarInput, 'path'> | null {
  if (!fileName.startsWith(`${videoBase}.`)) return null
  const match = /\.(srt|ass|ssa|vtt)$/i.exec(fileName)
  if (!match) return null
  const tokens = fileName
    .slice(videoBase.length + 1, fileName.length - match[0].length)
    .split('.')
    .filter(Boolean)
  const language = tokens[0] && /^[a-z]{2,3}$/i.test(tokens[0]) ? tokens[0].toLowerCase() : null
  return {
    language: language === 'und' ? null : language,
    forced: tokens.includes('forced'),
    hearingImpaired: tokens.includes('sdh'),
  }
}

/**
 * The full ffmpeg argument list for one version.
 *
 * Output is always Matroska: it takes every subtitle format a release comes
 * with, and Infuse, Jellyfin and VLC all play it. Progress goes to stdout as
 * key=value lines (`-progress pipe:1`), which is what the encoder parses.
 */
export function buildVersionEncodeArgs(input: VersionEncodeInput): string[] {
  const { analysis, profile, encoder } = input
  const hdr = isHdr(analysis)
  const highBitDepth = isHighBitDepth(analysis)
  const target = targetDimensions(analysis.videoWidth!, analysis.videoHeight!, profile.maxHeight)
  const quality = QUALITY_VALUES[profile.quality] ?? QUALITY_VALUES.balanced
  const device = input.vaapiDevice ?? '/dev/dri/renderD128'

  const args: string[] = ['-hide_banner', '-nostdin', '-y', '-loglevel', 'error']

  // --- inputs ---
  // ffmpeg 6.1's GPU scaler (scale_vaapi) runs out of surfaces while the
  // decoder flushes the last frames of a file, so any encode that resizes on
  // the GPU dies a second before the end. Resizing on the CPU is complete and,
  // for anything up to 1080p, still runs at several hundred frames a second.
  // A 4K source is the exception: pulling its frames off the GPU to scale them
  // costs three quarters of the speed, so it stays on the GPU and the runner
  // accepts the lost final second (see `encodeStoppedAtFlush`).
  const gpuScale = encoder === 'vaapi' && target.scaled && analysis.videoHeight! > GPU_SCALE_ABOVE
  const gpuFrames = encoder === 'vaapi' && (!target.scaled || gpuScale)
  if (encoder === 'vaapi') {
    args.push('-init_hw_device', `vaapi=va:${device}`, '-hwaccel', 'vaapi')
    if (gpuFrames) args.push('-hwaccel_output_format', 'vaapi')
    args.push('-hwaccel_device', 'va')
    if (!gpuFrames) args.push('-filter_hw_device', 'va')
  } else if (encoder === 'vaapi-upload') {
    args.push('-init_hw_device', `vaapi=va:${device}`, '-filter_hw_device', 'va')
  }
  args.push('-i', input.sourcePath)

  const sidecars = profile.subtitles ? (input.sidecars ?? []) : []
  for (const sidecar of sidecars) {
    args.push('-i', sidecar.path)
  }

  // --- stream selection ---
  // `V` skips attached pictures, so cover art never stands in for the film.
  args.push('-map', '0:V:0')
  const audio = selectAudioTracks(analysis)
  for (const index of audio) {
    args.push('-map', `0:${index}`)
  }
  const subtitles = profile.subtitles ? usableSubtitleIndices(analysis, input.subtitleIndices) : []
  for (const index of subtitles) {
    args.push('-map', `0:${index}`)
  }
  sidecars.forEach((_, i) => args.push('-map', `${i + 1}:0`))
  args.push('-map_metadata', '0', '-map_chapters', '0')

  // --- video ---
  const pixel = highBitDepth ? 'p010' : 'nv12'
  const size = target.scaled ? `w=${target.width}:h=${target.height}:` : ''
  const cpuScale = target.scaled ? `scale=${target.width}:${target.height}:flags=bicubic,` : ''
  if (gpuFrames) {
    args.push('-vf', `scale_vaapi=${size}format=${pixel}`)
  } else if (encoder === 'vaapi' || encoder === 'vaapi-upload') {
    args.push('-vf', `${cpuScale}format=${highBitDepth ? 'p010le' : 'nv12'},hwupload`)
  } else {
    const filters = target.scaled ? [`scale=${target.width}:${target.height}:flags=lanczos`] : []
    filters.push(`format=${highBitDepth ? 'yuv420p10le' : 'yuv420p'}`)
    args.push('-vf', filters.join(','))
  }

  if (encoder === 'x265') {
    const params = ['log-level=error']
    if (hdr) params.push('hdr10=1', 'hdr10-opt=1', 'repeat-headers=1')
    args.push(
      '-c:v',
      'libx265',
      '-preset',
      'medium',
      '-crf',
      String(quality.x265),
      '-x265-params',
      params.join(':')
    )
  } else {
    // ICQ is the GPU's constant-quality mode: bits go where the picture needs
    // them, the same idea as x265's CRF.
    const rateControl =
      input.vaapiRateControl === 'CQP'
        ? ['-rc_mode', 'CQP', '-qp', String(quality.vaapi + CQP_OFFSET)]
        : ['-rc_mode', 'ICQ', '-global_quality', String(quality.vaapi)]
    args.push('-c:v', 'hevc_vaapi', '-profile:v', highBitDepth ? 'main10' : 'main', ...rateControl)
  }

  // Colour tags travel with the stream, not the container. Without them an
  // HDR10 copy plays as washed-out SDR.
  if (analysis.videoColorPrimaries) args.push('-color_primaries', analysis.videoColorPrimaries)
  if (analysis.videoColorTransfer) args.push('-color_trc', analysis.videoColorTransfer)
  if (analysis.videoColorSpace) args.push('-colorspace', analysis.videoColorSpace)

  // --- audio ---
  const channelsByIndex = new Map(analysis.audioTracks.map((t) => [t.index, t.channels ?? 2]))
  audio.forEach((index, i) => {
    const channels = channelsByIndex.get(index) ?? 2
    if (profile.audio === 'surround' && channels > 2) {
      // E-AC-3 5.1 is what streaming services ship; Infuse and Apple TV pass
      // it straight through to a receiver or spatialise it on AirPods.
      args.push(`-c:a:${i}`, 'eac3', `-b:a:${i}`, '448k', `-ac:a:${i}`, '6')
      args.push(`-metadata:s:a:${i}`, 'title=5.1')
    } else {
      args.push(`-c:a:${i}`, 'aac', `-b:a:${i}`, '160k', `-ac:a:${i}`, '2')
      args.push(`-metadata:s:a:${i}`, 'title=Stereo')
    }
  })

  // --- subtitles ---
  const byIndex = new Map(analysis.subtitleTracks.map((track) => [track.index, track]))
  subtitles.forEach((index, i) => {
    args.push(`-c:s:${i}`, subtitleCodecArgs(byIndex.get(index)) ?? 'copy')
  })
  sidecars.forEach((sidecar, j) => {
    const i = subtitles.length + j
    args.push(`-c:s:${i}`, 'copy')
    if (sidecar.language) args.push(`-metadata:s:s:${i}`, `language=${sidecar.language}`)
    if (sidecar.forced) args.push(`-disposition:s:${i}`, 'forced')
    else if (sidecar.hearingImpaired) args.push(`-disposition:s:${i}`, 'hearing_impaired')
  })

  args.push('-max_muxing_queue_size', '4096', '-f', 'matroska')
  args.push('-progress', 'pipe:1', '-nostats', input.outputPath)
  return args
}
