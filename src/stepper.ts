export type Stage = [width: number, height: number]

// min size = 0 results in infinite loop,
// min size = 1 can consume large amount of memory
const MIN_INNER_TILE_SIZE = 2

const DEST_TILE_BORDER = 3 // Max possible filter window size

export default function createStages (
  fromWidth: number,
  fromHeight: number,
  toWidth: number,
  toHeight: number,
  srcTileSize: number
): Stage[] {
  const scaleX = toWidth / fromWidth
  const scaleY = toHeight / fromHeight

  // derived from createRegions equation:
  // innerTileWidth = pixelFloor(srcTileSize * scaleX) - 2 * destTileBorder;
  const minScale = (2 * DEST_TILE_BORDER + MIN_INNER_TILE_SIZE + 1) / srcTileSize

  // refuse to scale image multiple times by less than twice each time,
  // it could only happen because of invalid options
  if (minScale > 0.5) return [[toWidth, toHeight]]

  const stageCount = Math.ceil(Math.log(Math.min(scaleX, scaleY)) / Math.log(minScale))

  // no additional resizes are necessary,
  // stageCount can be zero or be negative when enlarging the image
  if (stageCount <= 1) return [[toWidth, toHeight]]

  const result: Stage[] = []

  for (let i = 0; i < stageCount; i++) {
    const width = Math.round(
      Math.pow(
        Math.pow(fromWidth, stageCount - i - 1) * Math.pow(toWidth, i + 1),
        1 / stageCount
      )
    )

    const height = Math.round(
      Math.pow(
        Math.pow(fromHeight, stageCount - i - 1) * Math.pow(toHeight, i + 1),
        1 / stageCount
      )
    )

    result.push([width, height])
  }

  return result
}
