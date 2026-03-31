import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DiffResult {
  diffPixels: number
  diffPercent: number
  width: number
  height: number
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compares two PNG buffers pixel-by-pixel using pixelmatch.
 * Writes the diff image to diffOutputPath.
 *
 * Throws if dimensions don't match — normalization via sharp must run before this.
 *
 * threshold defaults to process.env.DIFF_THRESHOLD ?? 0.1
 * Pass null to use the env/default value explicitly.
 */
export function runDiff(
  baselineBuffer: Buffer,
  currentBuffer: Buffer,
  diffOutputPath: string,
  threshold: number | null = null
): DiffResult {
  const resolvedThreshold =
    threshold ??
    (process.env['DIFF_THRESHOLD'] != null
      ? Number(process.env['DIFF_THRESHOLD'])
      : 0.1)

  const baseline = PNG.sync.read(baselineBuffer)
  const current  = PNG.sync.read(currentBuffer)

  if (baseline.width !== current.width || baseline.height !== current.height) {
    throw new Error(
      `Dimension mismatch: baseline is ${baseline.width}×${baseline.height} ` +
      `but current is ${current.width}×${current.height}. ` +
      `Run sharp normalization before diffing.`
    )
  }

  const { width, height } = baseline
  const diff = new PNG({ width, height })

  const diffPixels = pixelmatch(
    baseline.data,
    current.data,
    diff.data,
    width,
    height,
    { threshold: resolvedThreshold }
  )

  fs.mkdirSync(path.dirname(diffOutputPath), { recursive: true })
  fs.writeFileSync(diffOutputPath, PNG.sync.write(diff))

  const diffPercent = (diffPixels / (width * height)) * 100

  return { diffPixels, diffPercent, width, height }
}
