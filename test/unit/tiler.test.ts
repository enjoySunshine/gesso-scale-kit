import assert from 'assert'
import createRegions, { canCreateRegions } from '../../src/tiler'

const TILE_SIZE = 1024

describe('tiler', () => {
  describe('canCreateRegions', () => {
    it('returns true when the destination fits the tile border', () => {
      // 512x32 -> 40x8, unsharp radius 2 => border 5: regular tiling is possible
      assert.strictEqual(canCreateRegions({
        width: 512,
        height: 32,
        srcTileSize: TILE_SIZE,
        toWidth: 40,
        toHeight: 8,
        destTileBorder: 5
      }), true)
    })

    it('returns false when the destination is too small for the tile border', () => {
      // 800x40 -> 8x4, unsharp radius 2 => border 5:
      // floor(1024 * 4/40) - 10 = 0, tiling cannot fit the unsharp border
      assert.strictEqual(canCreateRegions({
        width: 800,
        height: 40,
        srcTileSize: TILE_SIZE,
        toWidth: 8,
        toHeight: 4,
        destTileBorder: 5
      }), false)

      // 1000x40 -> 9x4, same border
      assert.strictEqual(canCreateRegions({
        width: 1000,
        height: 40,
        srcTileSize: TILE_SIZE,
        toWidth: 9,
        toHeight: 4,
        destTileBorder: 5
      }), false)
    })

    it('returns true for the same tiny destination without a tile border', () => {
      assert.strictEqual(canCreateRegions({
        width: 800,
        height: 40,
        srcTileSize: TILE_SIZE,
        toWidth: 8,
        toHeight: 4,
        destTileBorder: 0
      }), true)
    })
  })

  describe('createRegions', () => {
    it('still throws when the inner tile is too small', () => {
      assert.throws(() => createRegions({
        width: 800,
        height: 40,
        srcTileSize: TILE_SIZE,
        toWidth: 8,
        toHeight: 4,
        destTileBorder: 5
      }), /target tile width\/height is too small/)
    })

    it('covers the whole destination when no border is required', () => {
      const tiles = createRegions({
        width: 800,
        height: 40,
        srcTileSize: TILE_SIZE,
        toWidth: 8,
        toHeight: 4,
        destTileBorder: 0
      })

      assert.strictEqual(tiles.length, 1)
      assert.deepStrictEqual(
        [tiles[0].toX, tiles[0].toY, tiles[0].toWidth, tiles[0].toHeight],
        [0, 0, 8, 4]
      )
    })
  })
})
