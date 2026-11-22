import { Canvas } from '@napi-rs/canvas'
import picaFactory from '../../src/pica_main'

// Documented way to use pica in Node.js: expose an external canvas library as
// the global OffscreenCanvas. Workers are not used in Node.js.
globalThis.OffscreenCanvas = Canvas as any

const UNSHARP = { unsharpAmount: 160, unsharpRadius: 2, unsharpThreshold: 0 }
const TILE = 1024

function halfGrayCanvas (w: number, h: number): any {
  const c = new OffscreenCanvas(w, h)
  const ctx = (c as any).getContext('2d')!
  ctx.fillStyle = '#282828'
  ctx.fillRect(0, 0, Math.floor(w / 2), h)
  ctx.fillStyle = '#d2d2d2'
  ctx.fillRect(Math.floor(w / 2), 0, w - Math.floor(w / 2), h)
  return c
}

function solidCanvas (w: number, h: number, v: number): any {
  const c = new OffscreenCanvas(w, h)
  const ctx = (c as any).getContext('2d')!
  ctx.fillStyle = `rgb(${v},${v},${v})`
  ctx.fillRect(0, 0, w, h)
  return c
}

function getImageData (canvas: any): Uint8ClampedArray {
  return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
}

function middleRowRed (canvas: any): number[] {
  const w = canvas.width
  const h = canvas.height
  const data = getImageData(canvas)
  const y = Math.floor(h / 2)
  const row: number[] = []
  for (let x = 0; x < w; x++) row.push(data[(y * w + x) * 4])
  return row
}

async function resize (features: string[], src: any, w: number, h: number, opts: Record<string, unknown> = {}): Promise<any> {
  const pica = picaFactory({ features: features as any, tile: TILE })
  const dst = new OffscreenCanvas(w, h)
  await pica.resize(src, dst, { filter: 'mks2013', ...opts })
  return dst
}

describe('tiny resize with unsharp mask', () => {
  for (const feature of ['js', 'wasm'] as const) {
    const features = [feature]

    it(`(${feature}) resizes 800x40 -> 8x4 with unsharp instead of throwing`, async () => {
      const dst = await resize(features, halfGrayCanvas(800, 40), 8, 4, UNSHARP)
      expect(middleRowRed(dst)).toEqual([24, 8, 0, 0, 255, 255, 242, 226])
    })

    it(`(${feature}) resizes 1000x40 -> 9x4 with unsharp instead of throwing`, async () => {
      const dst = await resize(features, halfGrayCanvas(1000, 40), 9, 4, UNSHARP)
      expect(middleRowRed(dst)).toEqual([28, 17, 0, 0, 125, 255, 255, 233, 222])
    })

    it(`(${feature}) keeps the unsharp-disabled 800x40 -> 8x4 row untouched`, async () => {
      const dst = await resize(features, halfGrayCanvas(800, 40), 8, 4)
      expect(middleRowRed(dst)).toEqual([40, 40, 33, 47, 203, 217, 210, 210])
    })

    it(`(${feature}) keeps the 1000x50 -> 7x4 row untouched`, async () => {
      const dst = await resize(features, halfGrayCanvas(1000, 50), 7, 4, UNSHARP)
      expect(middleRowRed(dst)).toEqual([17, 0, 0, 127, 255, 254, 233])
    })

    it(`(${feature}) keeps the 512x32 -> 40x8 row untouched`, async () => {
      const dst = await resize(features, halfGrayCanvas(512, 32), 40, 8, UNSHARP)
      expect(middleRowRed(dst)).toEqual([
        40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 39, 38, 36, 32, 24, 8, 0, 0,
        255, 255, 242, 226, 218, 214, 212, 211, 210, 210, 210, 210, 210, 210, 210, 210,
        210, 210, 210, 210
      ])
    })

    it(`(${feature}) keeps the 400x40 -> 48x8 row untouched`, async () => {
      const dst = await resize(features, halfGrayCanvas(400, 40), 48, 8, UNSHARP)
      expect(middleRowRed(dst)).toEqual([
        40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 39, 38, 36, 32,
        24, 8, 0, 0, 255, 255, 242, 226, 218, 214, 212, 211, 210, 210, 210, 210, 210, 210,
        210, 210, 210, 210, 210, 210, 210, 210, 210, 210
      ])
    })

    it(`(${feature}) produces gray pixels (R=G=B) with opaque alpha on the fixed sizes`, async () => {
      const dst = await resize(features, halfGrayCanvas(800, 40), 8, 4, UNSHARP)
      const data = getImageData(dst)
      for (let i = 0; i < data.length; i += 4) {
        expect(data[i + 1]).toBe(data[i])
        expect(data[i + 2]).toBe(data[i])
        expect(data[i + 3]).toBe(255)
      }
    })

    for (const v of [255, 127]) {
      it(`(${feature}) keeps solid ${v} unchanged (RGB=${v}, alpha=255)`, async () => {
        const dst = await resize(features, solidCanvas(1000, 768, v), 140, 108, UNSHARP)
        const data = getImageData(dst)
        for (let i = 0; i < data.length; i += 4) {
          expect(data[i]).toBe(v)
          expect(data[i + 1]).toBe(v)
          expect(data[i + 2]).toBe(v)
          expect(data[i + 3]).toBe(255)
        }
      })
    }

    for (const filter of ['lanczos3', 'lanczos2', 'hamming', 'box'] as const) {
      it(`(${feature}) does not throw for ${filter} at the tiny size`, async () => {
        const dst = await resize(features, halfGrayCanvas(800, 40), 8, 4, { filter })
        expect(dst.width).toBe(8)
        expect(dst.height).toBe(4)
      })
    }

    it(`(${feature}) matches a single unsharp pass over the fully resized image`, async () => {
      const pica = picaFactory({ features: features as any, tile: TILE })

      // Reference: resize without sharpening, then unsharp the whole result once
      const src = halfGrayCanvas(800, 40)
      const resized = new OffscreenCanvas(8, 4)
      await pica.resize(src, resized, { filter: 'mks2013' })
      const refCtx = resized.getContext('2d')!
      const refData = refCtx.getImageData(0, 0, 8, 4)
      // @ts-ignore - __mathlib is ready after the resize above
      pica.__mathlib.unsharp_mask(refData.data, 8, 4, 160, 2, 0)
      refCtx.putImageData(refData, 0, 0)

      const sharpened = new OffscreenCanvas(8, 4)
      await pica.resize(halfGrayCanvas(800, 40), sharpened, { filter: 'mks2013', ...UNSHARP })

      expect(Array.from(getImageData(sharpened))).toEqual(Array.from(refCtx.getImageData(0, 0, 8, 4).data))
    })

    it(`(${feature}) stays working across multi-stage resizes`, async () => {
      // 4096x40 -> 8x4 goes through several resize stages; the last stage is
      // small enough to require the whole-image unsharp fallback.
      const dst = await resize(features, halfGrayCanvas(4096, 40), 8, 4, UNSHARP)
      expect(dst.width).toBe(8)
      expect(dst.height).toBe(4)
      const data = getImageData(dst)
      for (let i = 0; i < data.length; i += 4) {
        expect(data[i + 1]).toBe(data[i])
        expect(data[i + 2]).toBe(data[i])
        expect(data[i + 3]).toBe(255)
      }
    })
  }

  it('js and wasm give identical pixels for the formerly failing size', async () => {
    const jsDst = await resize(['js'], halfGrayCanvas(1000, 40), 9, 4, UNSHARP)
    const wasmDst = await resize(['wasm'], halfGrayCanvas(1000, 40), 9, 4, UNSHARP)
    expect(Array.from(getImageData(wasmDst))).toEqual(Array.from(getImageData(jsDst)))
  })
})
