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
// Deja intacto el .tmj fuente (editable en Tiled). Genera, por cada mapa
// <base>:  <base>.optimized.tmj, <base>-packed.png, <base>-objects.png,
//          <base>-ysort.json
//
// Uso:
//   node scripts/optimize-map.mjs            → procesa el mapa por defecto (map.tmj)
//   node scripts/optimize-map.mjs InteriorHospital.tmj  → procesa ese mapa
//   (reejecutar tras cada reexport de Tiled)

import { readFileSync, writeFileSync, statSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, basename } from 'path'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MAPS_DIR = join(__dirname, '..', 'public', 'assets', 'maps')

// Mapa a procesar: argumento o "map.tmj" por defecto.
const SRC_ARG = process.argv[2] || 'map.tmj'
const BASE = basename(SRC_ARG).replace(/\.tmj$|\.json$/i, '')
// Compatibilidad: el mapa "map" conserva los nombres antiguos (packed-tiles, etc.)
const isDefault = BASE === 'map'
const PACKED_NAME = isDefault ? 'packed-tiles' : `${BASE}-packed`
const OBJ_NAME    = isDefault ? 'objects'      : `${BASE}-objects`

const SRC     = join(MAPS_DIR, SRC_ARG)
const OUT_MAP = join(MAPS_DIR, `${BASE}.optimized.tmj`)
const OUT_PNG = join(MAPS_DIR, `${PACKED_NAME}.png`)

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

const OUT_OBJ_PNG  = join(MAPS_DIR, `${OBJ_NAME}.png`)
const OUT_OBJ_JSON = join(MAPS_DIR, `${isDefault ? 'ysort' : BASE + '-ysort'}.json`)

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

// Procesa las object layers de objetos: "ysort" (normal) y "ysortTop"
// (siempre por encima de ysort). Todas las instancias van a un mismo atlas.
const objLayers = map.layers.filter(
  l => l.type === 'objectgroup' && /^ysort(top)?$/i.test(l.name),
)
if (objLayers.length) {
  const origTilesets = JSON.parse(readFileSync(SRC, 'utf8')).tilesets
    .slice().sort((a, b) => a.firstgid - b.firstgid)
  const tsForGid = gid => {
    let f = null
    for (const t of origTilesets) { if (gid >= t.firstgid) f = t; else break }
    return f
  }

  const collForTile = tile => (tile?.objectgroup?.objects ?? []).map(c => {
    const b = { x: c.x, y: c.y, w: c.width, h: c.height }
    if (c.ellipse) b.ellipse = true
    if (c.polygon) b.polygon = c.polygon
    if (c.polyline) b.polyline = c.polyline
    return b
  })

  // Reunir imágenes únicas usadas y sus datos (tamaño + colisión + recorte).
  // Soporta dos orígenes de tile-object:
  //   - Collection of Images: cada tile tiene su propia `image`.
  //   - Tileset en cuadrícula: se recorta el tile del PNG del tileset por su
  //     posición en el grid.
  const uniq = new Map()   // name -> { path, sx, sy, w, h, coll }
  const instances = []
  for (const layer of objLayers) {
    const isTop = /top$/i.test(layer.name)
    for (const o of layer.objects) {
      if (!o.gid) continue
      const base = (o.gid & FLIP_MASK) >>> 0
      const ts = tsForGid(base)
      if (!ts) continue
      const localId = base - ts.firstgid
      const tile = ts.tiles?.find(t => t.id === localId)

      let name
      if (tile?.image) {
        // Collection of Images: recorte completo de su PNG propio
        name = tile.image.split(/[\\/]/).pop()
        if (!uniq.has(name)) {
          uniq.set(name, {
            path: pngIndex[name], sx: 0, sy: 0,
            w: tile.imagewidth, h: tile.imageheight, coll: collForTile(tile),
          })
        }
      } else if (ts.image) {
        // Tileset en cuadrícula: recorte por posición del tile en el grid
        const cols = ts.columns
        const sx = (ts.margin ?? 0) + (localId % cols) * (TW + (ts.spacing ?? 0))
        const sy = (ts.margin ?? 0) + Math.floor(localId / cols) * (TH + (ts.spacing ?? 0))
        const png = ts.image.split(/[\\/]/).pop()
        name = `${ts.name}#${localId}`   // id único de este tile del tileset
        if (!uniq.has(name)) {
          uniq.set(name, {
            path: pngIndex[png], sx, sy, w: TW, h: TH, coll: collForTile(tile),
          })
        }
      } else {
        continue
      }

      const props = {}
      for (const p of (o.properties ?? [])) props[p.name] = p.value

      // Tiled ancla tile-objects por la esquina inferior-izquierda:
      // o.x = izquierda, o.y = base (inferior). Convertimos a sup-izq.
      const inst = { name, x: o.x, y: o.y - o.height, w: o.width, h: o.height }
      if (isTop) inst.top = true
      if (props.onTop) inst.onTop = true
      instances.push(inst)
    }
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

  // Cada objeto puede ser imagen completa (Collection) o un recorte del PNG del
  // tileset (cuadrícula). Preparamos el buffer correspondiente.
  const objComposite = []
  for (const n of names) {
    const u = uniq.get(n)
    if (!u.path) continue
    let input
    if (u.sx === 0 && u.sy === 0 && u.w >= 0 /* Collection: imagen entera */
        && !n.includes('#')) {
      input = u.path
    } else {
      input = await sharp(u.path)
        .extract({ left: u.sx, top: u.sy, width: u.w, height: u.h })
        .png().toBuffer()
    }
    objComposite.push({ input, left: frames[n].x, top: frames[n].y })
  }

  await sharp({
    create: { width: atlasObjW, height: atlasObjH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite(objComposite).png().toFile(OUT_OBJ_PNG)

  // JSON: frames del atlas + colisiones por imagen + instancias
  const ysortData = {
    atlas: `${OBJ_NAME}.png`,
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
