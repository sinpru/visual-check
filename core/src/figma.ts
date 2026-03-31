import sharp from 'sharp'

// ─── Error types ──────────────────────────────────────────────────────────────

export class FigmaNodeNotFoundError extends Error {
  constructor(nodeId: string) {
    super(`Figma node not found: ${nodeId}`)
    this.name = 'FigmaNodeNotFoundError'
  }
}

export class FigmaAssetFetchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FigmaAssetFetchError'
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FrameDimensions {
  width: number
  height: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FIGMA_BASE = 'https://api.figma.com/v1'

async function figmaGet<T>(
  path: string,
  token: string,
  attempt = 1
): Promise<T> {
  const res = await fetch(`${FIGMA_BASE}${path}`, {
    headers: { 'X-Figma-Token': token },
  })

  // 429 — exponential backoff, max 3 attempts (1s / 2s / 4s)
  if (res.status === 429 && attempt <= 3) {
    const delay = 1000 * Math.pow(2, attempt - 1)
    await sleep(delay)
    return figmaGet<T>(path, token, attempt + 1)
  }

  if (!res.ok) {
    throw new Error(`Figma API responded ${res.status} for ${path}`)
  }

  return res.json() as Promise<T>
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches the native pixel dimensions of a Figma frame node.
 *
 * Hits GET /v1/files/{fileKey}/nodes?ids={nodeId}
 * Parses absoluteBoundingBox from the node document.
 * Throws FigmaNodeNotFoundError if the node is absent or has no bounding box.
 */
export async function getFrameDimensions(
  fileKey: string,
  nodeId: string,
  token: string
): Promise<FrameDimensions> {
  type NodesResponse = {
    nodes: Record<
      string,
      { document: { absoluteBoundingBox?: { width: number; height: number } } } | null
    >
  }

  const data = await figmaGet<NodesResponse>(
    `/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`,
    token
  )

  const node = data.nodes[nodeId]
  const bb = node?.document?.absoluteBoundingBox

  if (!bb) {
    throw new FigmaNodeNotFoundError(nodeId)
  }

  return { width: Math.round(bb.width), height: Math.round(bb.height) }
}

/**
 * Fetches a Figma frame as a PNG buffer, resized to the target dimensions.
 *
 * Steps:
 *   1. getFrameDimensions → native size
 *   2. scale = targetWidth / nativeWidth, clamped to [0.01, 4]
 *   3. GET /v1/images → CDN URL (not bytes)
 *   4. fetch(cdnUrl) → raw PNG bytes
 *   5. sharp().resize(targetWidth, targetHeight, { fit: 'fill' }).png() → Buffer
 *
 * Throws FigmaNodeNotFoundError or FigmaAssetFetchError on failure.
 */
export async function fetchFigmaBaseline(
  fileKey: string,
  nodeId: string,
  token: string,
  targetWidth: number,
  targetHeight: number
): Promise<Buffer> {
  // Step 1 — native dimensions
  const { width: nativeWidth } = await getFrameDimensions(fileKey, nodeId, token)

  // Step 2 — compute scale, clamped to Figma's allowed range
  const rawScale = targetWidth / nativeWidth
  const scale = Math.min(4, Math.max(0.01, rawScale))

  // Step 3 — request render URL from Figma
  type ImagesResponse = {
    err: string | null
    images: Record<string, string | null>
  }

  const imgData = await figmaGet<ImagesResponse>(
    `/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=png&scale=${scale}`,
    token
  )

  if (imgData.err) {
    throw new FigmaAssetFetchError(`Figma image render error: ${imgData.err}`)
  }

  const cdnUrl = imgData.images[nodeId]
  if (!cdnUrl) {
    throw new FigmaAssetFetchError(
      `Figma returned no CDN URL for node ${nodeId} (invisible or zero-opacity?)`
    )
  }

  // Step 4 — download raw bytes from CDN
  const cdnRes = await fetch(cdnUrl)
  if (!cdnRes.ok) {
    throw new FigmaAssetFetchError(
      `CDN fetch failed for node ${nodeId}: HTTP ${cdnRes.status}`
    )
  }

  const rawBuffer = Buffer.from(await cdnRes.arrayBuffer())

  // Step 5 — normalize to exact target dimensions via sharp
  const normalized = await sharp(rawBuffer)
    .resize(targetWidth, targetHeight, { fit: 'fill' })
    .png()
    .toBuffer()

  return normalized
}
