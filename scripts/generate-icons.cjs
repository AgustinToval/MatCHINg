// One-off script to generate PWA icons (solid background + "M" glyph drawn as simple shapes).
const fs = require('fs')
const path = require('path')
const { PNG } = require('pngjs')

const OUT_DIR = path.join(__dirname, '..', 'public', 'icons')
fs.mkdirSync(OUT_DIR, { recursive: true })

const BG = [0x6d, 0x28, 0xd9] // purple-700
const FG = [0xff, 0xff, 0xff]

function drawIcon(size) {
  const png = new PNG({ width: size, height: size })

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2
      png.data[idx] = BG[0]
      png.data[idx + 1] = BG[1]
      png.data[idx + 2] = BG[2]
      png.data[idx + 3] = 255
    }
  }

  // Draw a bold "M" using filled rectangles (two verticals + two diagonals approximated as parallelograms)
  const m = Math.round(size * 0.18) // margin
  const w = size - m * 2
  const thick = Math.round(size * 0.09)
  const top = m
  const bottom = size - m

  const setPx = (x, y) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const idx = (size * y + x) << 2
    png.data[idx] = FG[0]
    png.data[idx + 1] = FG[1]
    png.data[idx + 2] = FG[2]
    png.data[idx + 3] = 255
  }

  const fillRect = (x0, y0, x1, y1) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) setPx(x, y)
  }

  // left and right verticals
  fillRect(m, top, m + thick, bottom)
  fillRect(size - m - thick, top, size - m, bottom)

  // two diagonals meeting in the middle (forming the M's peaks/valley)
  const midX = size / 2
  const diagLen = bottom - top
  const halfW = w / 2 - thick
  for (let i = 0; i < diagLen * 0.65; i++) {
    const y = top + i
    const progress = i / (diagLen * 0.65)
    const leftX = m + thick + progress * halfW
    const rightX = size - m - thick - progress * halfW
    fillRect(Math.round(leftX), y, Math.round(leftX) + thick, y + 1)
    fillRect(Math.round(rightX) - thick, y, Math.round(rightX), y + 1)
  }

  return png
}

for (const size of [192, 512]) {
  const png = drawIcon(size)
  const buf = PNG.sync.write(png)
  fs.writeFileSync(path.join(OUT_DIR, `icon-${size}.png`), buf)
  console.log(`wrote icon-${size}.png`)
}

// Maskable icon: same design but with extra safe-area padding
function drawMaskable(size) {
  const png = new PNG({ width: size, height: size })
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2
      png.data[idx] = BG[0]
      png.data[idx + 1] = BG[1]
      png.data[idx + 2] = BG[2]
      png.data[idx + 3] = 255
    }
  }
  return png
}

const maskable = drawMaskable(512)
fs.writeFileSync(path.join(OUT_DIR, 'icon-maskable-512.png'), PNG.sync.write(maskable))
console.log('wrote icon-maskable-512.png')
