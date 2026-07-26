// Optimiza el mapa exportado de Tiled para el navegador.
//
// Problema: Tiled referencia 8 PNG-atlas gigantes (~35 millones de píxeles en
// total). El navegador tarda ~2.4 s en decodificarlos y subirlos a la GPU,
// aunque el mapa sólo usa ~1200 tiles distintos.
//
// Qué hace este script:
//   1. Reúne los gids realmente usados en las capas.
//   2. Recorta esos tiles de los PNG originales y los empaqueta en UN solo
//      atlas pequeño (packed-tiles.png).
//   3. Reescribe el mapa para usar ese único tileset, remapeando cada gid.
//   4. Conserva sólo las colisiones (objectgroup) de los tiles usados,
//      con su id remapeado al nuevo atlas.
//   5. Minifica el JSON.
//
// Deja intacto map.tmj (fuente editable en Tiled). Genera:
//   - public/assets/maps/map.optimized.tmj
//   - public/assets/maps/packed-tiles.png
//
// Uso:  node scripts/optimize-map.mjs   (reejecutar tras cada reexport de Tiled)

import { readFileSync, writeFileSync, statSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MAPS_DIR = join(__dirname, '..', 'public', 'assets', 'maps')
const SRC = join(MAPS_DIR, 'map.tmj')
const OUT_MAP = join(MAPS_DIR, 'map.optimized.tmj')
const OUT_PNG = join(MAPS_DIR, 'packed-tiles.png')
const PACKED_NAME = 'packed-tiles'

const TW = 32, TH = 32   // tamaño de tile
const FLIP_MASK = ~(0x80000000 | 0x40000000 | 0x20000000 | 0x10000000)

const map = JSON.parse(readFileSync(SRC, 'utf8'))

// ── 1. gids usados ────────────────────────────────────────────────
const usedGids = new Set()
for (const layer of map.layers) {
  if (layer.type !== 'tilelayer' || !Array.isArray(layer.data)) continue
  for (const gid of layer.data) {
    if (gid !== 0) usedGids.add((gid & FLIP_MASK) >>> 0)
  }
}
const sortedGids = [...usedGids].sort((a, b) => a - b)

// ── 2. Localizar cada gid en su tileset original ─────────────────
// Orden de tilesets por firstgid para resolver a qué tileset pertenece un gid
const tilesets = [...map.tilesets].sort((a, b) => a.firstgid - b.firstgid)
function tilesetFor(gid) {
  let found = null
  for (const ts of tilesets) {
    if (gid >= ts.firstgid) found = ts
    else break
  }
  return found
}

// Guardar, por cada gid usado, de qué PNG y en qué (x,y) recortar
const sources = {}   // name -> { image: sharp buffer promise, ts }
for (const ts of tilesets) {
  if (!ts.image) continue
  const png = ts.image.split(/[\\/]/).pop()
  const path = join(MAPS_DIR, png)
  if (existsSync(path)) sources[ts.name] = { path, ts }
}

// ── 3. Componer el atlas empaquetado ─────────────────────────────
const packCols = Math.ceil(Math.sqrt(sortedGids.length))
const packRows = Math.ceil(sortedGids.length / packCols)
const atlasW = packCols * TW
const atlasH = packRows * TH

// gidViejo -> índice local nuevo (0..n-1) en el atlas empaquetado
const remap = new Map()
sortedGids.forEach((gid, i) => remap.set(gid, i))

// Extraer cada tile de su PNG de origen
const loaded = {}   // name -> sharp instance (raw)
async function tileBuffer(gid) {
  const ts = tilesetFor(gid)
  const src = ts && sources[ts.name]
  if (!src) return null
  const localId = gid - ts.firstgid
  const cols = ts.columns
  const sx = (localId % cols) * TW
  const sy = Math.floor(localId / cols) * TH
  if (!loaded[ts.name]) loaded[ts.name] = sharp(src.path)
  // extract necesita una instancia fresca por recorte
  return sharp(src.path).extract({ left: sx, top: sy, width: TW, height: TH }).png().toBuffer()
}

const composite = []
for (const gid of sortedGids) {
  const i = remap.get(gid)
  const buf = await tileBuffer(gid)
  if (!buf) continue
  composite.push({
    input: buf,
    left: (i % packCols) * TW,
    top: Math.floor(i / packCols) * TH,
  })
}

await sharp({
  create: { width: atlasW, height: atlasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
}).composite(composite).png().toFile(OUT_PNG)

// ── 4. Reescribir el mapa con un único tileset ───────────────────
// Nuevos tiles con colisión, remapeando su id local
const newTiles = []
for (const ts of tilesets) {
  if (!Array.isArray(ts.tiles)) continue
  for (const tile of ts.tiles) {
    const gid = ts.firstgid + tile.id
    if (!remap.has(gid)) continue
    const newId = remap.get(gid)
    const copy = { ...tile, id: newId }
    newTiles.push(copy)
  }
}
newTiles.sort((a, b) => a.id - b.id)

map.tilesets = [{
  firstgid: 1,
  name: PACKED_NAME,
  image: `${PACKED_NAME}.png`,
  imagewidth: atlasW,
  imageheight: atlasH,
  tilewidth: TW,
  tileheight: TH,
  columns: packCols,
  tilecount: sortedGids.length,
  margin: 0,
  spacing: 0,
  ...(newTiles.length ? { tiles: newTiles } : {}),
}]

// Remapear los gids de cada capa (respetando flags de flip)
for (const layer of map.layers) {
  if (layer.type !== 'tilelayer' || !Array.isArray(layer.data)) continue
  layer.data = layer.data.map(gid => {
    if (gid === 0) return 0
    const flags = gid & ~FLIP_MASK
    const base = (gid & FLIP_MASK) >>> 0
    const idx = remap.get(base)
    if (idx === undefined) return 0
    return (idx + 1) | flags   // +1 porque firstgid=1
  })
}

// ── 4b. Objetos de la object layer "ysort" ──────────────────────
// Empaqueta las imágenes únicas de los tile-objects en un atlas aparte
// (tamaños variables) y genera un JSON con posición + colisión de base
// de cada instancia, para el Y-sort en la escena.
import { readdirSync } from 'fs'

const OUT_OBJ_PNG  = join(MAPS_DIR, 'objects.png')
const OUT_OBJ_JSON = join(MAPS_DIR, 'ysort.json')

// Índice de todos los PNG bajo public/assets/maps (por basename) para resolver
// las rutas del .tmj (que apuntan a Downloads con nombres de carpeta distintos).
const pngIndex = {}
function indexPngs(dir, rel = '') {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) indexPngs(join(dir, entry.name), join(rel, entry.name))
    else if (entry.name.toLowerCase().endsWith('.png')) pngIndex[entry.name] = join(dir, entry.name)
  }
}
indexPngs(MAPS_DIR)

const ysortLayer = map.layers.find(l => l.type === 'objectgroup' && /ysort/i.test(l.name))
if (ysortLayer) {
  const origTilesets = JSON.parse(readFileSync(SRC, 'utf8')).tilesets
    .slice().sort((a, b) => a.firstgid - b.firstgid)
  const tsForGid = gid => {
    let f = null
    for (const t of origTilesets) { if (gid >= t.firstgid) f = t; else break }
    return f
  }

  // Reunir imágenes únicas usadas y sus datos (tamaño + colisión)
  const uniq = new Map()   // basename -> { path, w, h, coll:[{x,y,w,h}] }
  const instances = []     // { name, x, y, w, h }  (x,y = esquina sup-izq en el mundo)
  for (const o of ysortLayer.objects) {
    if (!o.gid) continue
    const base = (o.gid & FLIP_MASK) >>> 0
    const ts = tsForGid(base)
    if (!ts || !ts.tiles) continue
    const tile = ts.tiles.find(t => t.id === base - ts.firstgid)
    if (!tile || !tile.image) continue
    const file = tile.image.split(/[\\/]/).pop()
    if (!uniq.has(file)) {
      // Conserva rectángulos, elipses y polígonos/polilíneas de la colisión.
      const coll = (tile.objectgroup?.objects ?? []).map(c => {
        const base = { x: c.x, y: c.y, w: c.width, h: c.height }
        if (c.ellipse) base.ellipse = true
        if (c.polygon) base.polygon = c.polygon
        if (c.polyline) base.polyline = c.polyline
        return base
      })
      uniq.set(file, { path: pngIndex[file], w: tile.imagewidth, h: tile.imageheight, coll })
    }
    // Propiedades personalizadas del objeto en Tiled (ej. onTop=true)
    const props = {}
    for (const p of (o.properties ?? [])) props[p.name] = p.value

    // Tiled ancla tile-objects por la esquina inferior-izquierda:
    // o.x = izquierda, o.y = base (inferior). Convertimos a sup-izq.
    const inst = { name: file, x: o.x, y: o.y - o.height, w: o.width, h: o.height }
    if (props.onTop) inst.onTop = true
    instances.push(inst)
  }

  // Empaquetar las imágenes únicas en filas (bin-packing simple por filas)
  const names = [...uniq.keys()]
  const missing = names.filter(n => !uniq.get(n).path)
  if (missing.length) console.warn(`⚠ Faltan ${missing.length} PNG de objetos:`, missing.slice(0, 5))

  const MAXW = 2048
  let x = 0, y = 0, rowH = 0, atlasObjW = 0
  const frames = {}   // name -> {x,y,w,h}
  for (const n of names) {
    const { w, h } = uniq.get(n)
    if (x + w > MAXW) { x = 0; y += rowH; rowH = 0 }
    frames[n] = { x, y, w, h }
    x += w; rowH = Math.max(rowH, h); atlasObjW = Math.max(atlasObjW, x)
  }
  const atlasObjH = y + rowH

  const objComposite = names
    .filter(n => uniq.get(n).path)
    .map(n => ({ input: uniq.get(n).path, left: frames[n].x, top: frames[n].y }))

  await sharp({
    create: { width: atlasObjW, height: atlasObjH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite(objComposite).png().toFile(OUT_OBJ_PNG)

  // JSON: frames del atlas + colisiones por imagen + instancias
  const ysortData = {
    atlas: 'objects.png',
    frames: Object.fromEntries(names.map(n => [n, { ...frames[n], coll: uniq.get(n).coll }])),
    instances,
  }
  writeFileSync(OUT_OBJ_JSON, JSON.stringify(ysortData))

  const mb2 = p => (statSync(p).size / 1024 / 1024).toFixed(2)
  console.log(`\nObjetos ysort:       ${instances.length} instancias · ${names.length} imágenes únicas`)
  console.log(`objects.png:         ${atlasObjW}x${atlasObjH} px · ${mb2(OUT_OBJ_PNG)} MB`)
  console.log(`ysort.json:          ${mb2(OUT_OBJ_JSON)} MB`)
}

// ── 5. Escribir minificado ───────────────────────────────────────
writeFileSync(OUT_MAP, JSON.stringify(map))

const mb = p => (statSync(p).size / 1024 / 1024).toFixed(2)
console.log(`Tiles usados:        ${sortedGids.length}`)
console.log(`Atlas empaquetado:   ${packCols}x${packRows} tiles (${atlasW}x${atlasH} px)`)
console.log(`Colisiones:          ${newTiles.length}`)
console.log(`map.tmj original:    ${mb(SRC)} MB`)
console.log(`map.optimized.tmj:   ${mb(OUT_MAP)} MB`)
console.log(`packed-tiles.png:    ${mb(OUT_PNG)} MB`)
