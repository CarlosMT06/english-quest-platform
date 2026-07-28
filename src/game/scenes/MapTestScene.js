import * as Phaser from 'phaser'
import { playSfx } from '../../utils/sfx'

// Escena de prueba del mapa de Tiled: jugador movible + colisiones por-forma.
//
// Usa MATTER.JS para respetar las formas exactas de colisión dibujadas en el
// Collision Editor de Tiled (rectángulos, polígonos y círculos), no solo cajas.
//
// El mapa usa un atlas empaquetado (packed-tiles.png) + un atlas de objetos
// (objects.png) con su JSON (ysort.json), generados por scripts/optimize-map.mjs.

const PACKED    = 'packed-tiles'   // tileset empaquetado
const CHAR      = 'character'       // sprite del jugador — caminata (32×64)
const CHAR_IDLE = 'character-idle'  // sprite del jugador — reposo (32×64)
const SPEED  = 4.2                  // velocidad del jugador (px/paso Matter)
const ZOOM   = 1.5                  // acercamiento de la cámara

export class MapTestScene extends Phaser.Scene {
  constructor(key = 'MapTestScene') {
    super(key)
  }

  // Config de archivos del mapa. Las subclases (interiores) la sobreescriben.
  // Todos los nombres de recurso son únicos por escena para no colisionar.
  mapConfig() {
    return {
      mapKey:  'city-map',
      tmj:     '/assets/maps/map.optimized.tmj',
      // tsName = nombre del tileset TAL COMO está en el .optimized.tmj
      // (lo define el script). key = key de la textura cargada en Phaser.
      packed:  { tsName: 'packed-tiles', key: 'city-packed', png: '/assets/maps/packed-tiles.png' },
      objects: { key: 'city-objects', png: '/assets/maps/objects.png' },
      ysort:   { key: 'city-ysort', json: '/assets/maps/ysort.json' },
      spawn:   { x: 40, y: 40 },   // tile por defecto
      speed:   SPEED,              // velocidad del jugador
    }
  }

  // Datos opcionales al entrar: { spawn: {x, y} } en píxeles del mundo, para
  // reaparecer frente a la puerta al volver de un interior. Si no viene, se usa
  // el spawn por defecto de la config.
  init(data) {
    this._returnSpawn = data?.spawn ?? null
    this._cfg = this.mapConfig()
  }

  preload() {
    const c = this._cfg
    this.load.tilemapTiledJSON(c.mapKey, c.tmj)
    this.load.image(c.packed.key, c.packed.png)
    this.load.image(c.objects.key, c.objects.png)
    this.load.json(c.ysort.key, c.ysort.json)
    if (!this.textures.exists(CHAR)) {
      this.load.spritesheet(CHAR, '/assets/map/sprites/character.png', {
        frameWidth: 32, frameHeight: 64,
      })
      this.load.spritesheet(CHAR_IDLE, '/assets/map/sprites/character_idle.png', {
        frameWidth: 32, frameHeight: 64,
      })
    }
  }

  create() {
    const c = this._cfg
    const map = this.make.tilemap({ key: c.mapKey })
    this.map = map

    // 1º arg: nombre del tileset en el .tmj; 2º arg: key de la textura cargada.
    const tileset = map.addTilesetImage(c.packed.tsName, c.packed.key)

    // ── Capas de tiles en orden, con profundidad ─────────────────
    // Cada capa marcada en Tiled con la propiedad booleana `above=true` (y las
    // que la sigan) se dibuja SOBRE el jugador; las anteriores, por DEBAJO.
    // Así el orden se controla desde Tiled sin tocar código.
    // Respaldo: si ninguna capa trae la propiedad, se usa ABOVE_FALLBACK.
    const ABOVE_FALLBACK = 'Decoraciones1'
    this.YSORT_BASE = 100

    // ¿Alguna capa declara la propiedad `above`?
    const layerProp = (ld, name) => (ld.properties ?? []).find(p => p.name === name)?.value
    const usesAboveProp = map.layers.some(ld => layerProp(ld, 'above') !== undefined)

    let abovePlayer = false
    const tileLayers = []
    map.layers.forEach((layerData, i) => {
      // Determina si esta capa marca el inicio de "encima del jugador"
      const isAboveMark = usesAboveProp
        ? layerProp(layerData, 'above') === true
        : layerData.name === ABOVE_FALLBACK
      if (isAboveMark) abovePlayer = true

      if (layerData.type === 'objectgroup') return
      const layer = map.createLayer(layerData.name, [tileset], 0, 0)
      if (!layer) return
      layer.setCullPadding(2, 2)
      layer.setDepth(abovePlayer ? this.YSORT_BASE + map.heightInPixels + 100 + i : i)
      tileLayers.push(layer)
    })

    // ── Colisiones por forma (rect / polígono / círculo) ─────────
    // Matter respeta la forma exacta dibujada en Tiled.
    this._buildTileCollisions(map, tileLayers)

    // ── Objetos Y-sortables (object layer "ysort") ───────────────
    this._buildYsortObjects()

    this.cameras.main.setBackgroundColor('#1d232b')

    const mapW = map.widthInPixels
    const mapH = map.heightInPixels
    this.matter.world.setBounds(0, 0, mapW, mapH)
    // Nota: NO usar cam.setBounds — impediría el scroll negativo necesario para
    // centrar mapas más pequeños que la pantalla. El clamp lo hace _updateCamera.

    // ── Animaciones del personaje ────────────────────────────────
    const { anims } = this
    anims.create({ key: 'walk-right', frames: anims.generateFrameNumbers(CHAR, { start: 0,  end: 5  }), frameRate: 10, repeat: -1 })
    anims.create({ key: 'walk-up',    frames: anims.generateFrameNumbers(CHAR, { start: 6,  end: 11 }), frameRate: 10, repeat: -1 })
    anims.create({ key: 'walk-left',  frames: anims.generateFrameNumbers(CHAR, { start: 12, end: 17 }), frameRate: 10, repeat: -1 })
    anims.create({ key: 'walk-down',  frames: anims.generateFrameNumbers(CHAR, { start: 18, end: 23 }), frameRate: 10, repeat: -1 })
    // Idle: mismo layout que walk, más lento
    anims.create({ key: 'idle-right', frames: anims.generateFrameNumbers(CHAR_IDLE, { start: 0,  end: 5  }), frameRate: 6, repeat: -1 })
    anims.create({ key: 'idle-up',    frames: anims.generateFrameNumbers(CHAR_IDLE, { start: 6,  end: 11 }), frameRate: 6, repeat: -1 })
    anims.create({ key: 'idle-left',  frames: anims.generateFrameNumbers(CHAR_IDLE, { start: 12, end: 17 }), frameRate: 6, repeat: -1 })
    anims.create({ key: 'idle-down',  frames: anims.generateFrameNumbers(CHAR_IDLE, { start: 18, end: 23 }), frameRate: 6, repeat: -1 })

    // ── Jugador (Matter) ─────────────────────────────────────────
    // El sprite mide 32×64; el cuerpo de colisión es una caja pequeña en los
    // pies. Creamos el cuerpo con un yOffset de render para que el sprite se
    // dibuje 22 px por encima del centro del cuerpo (pies abajo, cuerpo arriba).
    this.lastDir = 'down'
    const spawnX = this._returnSpawn?.x ?? (c.spawn.x * map.tileWidth  + map.tileWidth  / 2)
    const spawnY = this._returnSpawn?.y ?? (c.spawn.y * map.tileHeight + map.tileHeight / 2)
    const FEET_H = 18, FEET_W = 24
    this._bodyOffsetY = 22   // distancia del centro del cuerpo (pies) al centro del sprite

    const feetBody = this.matter.bodies.rectangle(spawnX, spawnY, FEET_W, FEET_H, {
      isStatic: false,
      render: { sprite: { yOffset: this._bodyOffsetY / 64 } }, // fracción de la altura del sprite
    })

    this.player = this.matter.add.sprite(spawnX, spawnY, CHAR_IDLE, 18)
    this.player.setExistingBody(feetBody)
    this.player.setFixedRotation()          // no rota al chocar
    this.player.setFrictionAir(0)           // sin inercia → arranque/frenado seco
    this.player.setFriction(0)
    this.player.setDepth(this.YSORT_BASE)
    this.player.play('idle-down')           // arranca en reposo mirando abajo

    // ── Sonido de pasos ──────────────────────────────────────────
    // Cada ciclo de walk tiene 6 frames; el pie toca el suelo 2 veces por
    // ciclo. Disparamos "step" al entrar en esos frames (índices 0 y 3 del
    // ciclo), solo durante la caminata (no en idle).
    const STEP_FRAMES = new Set([0, 3])
    this.player.on('animationupdate', (anim, frame) => {
      if (!anim.key.startsWith('walk-')) return
      if (STEP_FRAMES.has(frame.index - 1)) playSfx('step')
    })

    // ── Cámara ───────────────────────────────────────────────────
    // Control manual (como GameScene): sigue al jugador con clamp a los bordes;
    // si el mapa es más chico que el viewport en un eje, centra el mapa en él.
    this.cameras.main.setZoom(ZOOM)
    this._mapW = map.widthInPixels
    this._mapH = map.heightInPixels
    this._updateCamera()

    // ── Triggers de entrada a interiores (object layer "triggers") ─
    // Cada rectángulo con propiedad `target` es una puerta. Al entrar el
    // jugador, se avisa a React para cambiar de escenario (con retorno).
    this._triggers = this._buildTriggers(map)
    this._triggeredThisVisit = false

    // ── Input ────────────────────────────────────────────────────
    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    })

  }

  // Cámara: sigue al jugador con clamp a los bordes del mapa; si el mapa es más
  // pequeño que el viewport en un eje, centra el mapa en ese eje. (Igual que
  // GameScene: control manual del scroll, correcto con zoom.)
  _updateCamera() {
    const cam   = this.cameras.main
    const zoom  = cam.zoom
    const halfW = cam.width  / (2 * zoom)
    const halfH = cam.height / (2 * zoom)

    const midX = this._mapW <= halfW * 2
      ? this._mapW / 2
      : Phaser.Math.Clamp(this.player.x, halfW, this._mapW - halfW)
    const midY = this._mapH <= halfH * 2
      ? this._mapH / 2
      : Phaser.Math.Clamp(this.player.y, halfH, this._mapH - halfH)

    cam.scrollX = midX - cam.width  / 2
    cam.scrollY = midY - cam.height / 2
  }

  // Lee la object layer "triggers": rectángulos con propiedad `target`.
  // Devuelve [{ x, y, w, h, target }] en píxeles del mundo.
  _buildTriggers(map) {
    const layer = map.getObjectLayer('triggers')
    if (!layer) return []
    return layer.objects
      .map(o => {
        const target = (o.properties ?? []).find(p => p.name === 'target')?.value
        if (!target) return null
        return { x: o.x, y: o.y, w: o.width, h: o.height, target }
      })
      .filter(Boolean)
  }

  // Crea un cuerpo estático de Matter por cada forma dibujada en Tiled,
  // respetando rectángulos, polígonos y círculos.
  _buildTileCollisions(map, tileLayers) {
    const TW = map.tileWidth, TH = map.tileHeight
    for (const layer of tileLayers) {
      layer.forEachTile(tile => {
        const shapes = tile.tileset?.getTileCollisionGroup(tile.index)
        if (!shapes || !shapes.objects || !shapes.objects.length) return
        // Origen del tile en el mundo, derivado de su columna/fila (robusto).
        const ox = tile.x * TW
        const oy = tile.y * TH
        for (const obj of shapes.objects) {
          this._addMatterShape(obj, ox, oy)
        }
      }, this, 0, 0, map.width, map.height)
    }
  }

  // Añade un cuerpo estático Matter para una forma (obj) cuyo origen local
  // (0,0) está en (ox, oy) del mundo.
  _addMatterShape(obj, ox, oy) {
    const opts = { isStatic: true }
    // Rectángulo (con o sin width/height completos)
    if (!obj.polygon && !obj.polyline && !obj.ellipse) {
      const w = obj.width, h = obj.height
      if (w <= 0 || h <= 0) return
      this.matter.add.rectangle(ox + obj.x + w / 2, oy + obj.y + h / 2, w, h, opts)
      return
    }
    // Elipse / círculo
    if (obj.ellipse) {
      const rx = obj.width / 2, ry = obj.height / 2
      if (rx <= 0 || ry <= 0) return
      const cx0 = ox + obj.x + rx, cy0 = oy + obj.y + ry
      // Círculo real (ejes ~iguales) → cuerpo círculo (más eficiente).
      if (Math.abs(rx - ry) < 0.5) {
        this.matter.add.circle(cx0, cy0, (rx + ry) / 2, opts)
        return
      }
      // Elipse real → aproximar con un polígono elíptico (Matter no tiene elipse).
      const N = 20
      const verts = []
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2
        verts.push({ x: cx0 + Math.cos(a) * rx, y: cy0 + Math.sin(a) * ry })
      }
      this.matter.add.fromVertices(cx0, cy0, verts, opts, true)
      return
    }
    // Polígono / polilínea → cuerpo poligonal exacto
    const pts = obj.polygon || obj.polyline
    if (!pts || pts.length < 3) {
      // Una polilínea de 2 puntos no forma área: la ignoramos
      return
    }
    // Vértices en coordenadas del mundo (donde deben quedar exactamente)
    const verts = pts.map(p => ({ x: ox + obj.x + p.x, y: oy + obj.y + p.y }))

    // Bounding box ESPERADO (según los vértices de Tiled)
    const exMinX = Math.min(...verts.map(v => v.x))
    const exMinY = Math.min(...verts.map(v => v.y))

    // fromVertices coloca el cuerpo según su propio centroide (distinto para
    // convexos vs. cóncavos). Lo creamos y luego lo desplazamos alineando su
    // bounding box real con el esperado — robusto para cualquier forma.
    const b = this.matter.add.fromVertices(exMinX, exMinY, verts, opts, true)
    if (!b) return

    const dx = exMinX - b.bounds.min.x
    const dy = exMinY - b.bounds.min.y
    this.matter.body.setPosition(b, { x: b.position.x + dx, y: b.position.y + dy })
  }

  // Y inferior (relativa a la imagen) de una forma de colisión del JSON.
  _collBottom(c) {
    if (c.polygon || c.polyline) {
      const pts = c.polygon || c.polyline
      return c.y + Math.max(...pts.map(p => p.y))
    }
    return c.y + (c.h ?? 0)   // rect / elipse: y + alto
  }

  // Instancia los objetos de "ysort"/"ysortTop" como imágenes del atlas,
  // con Y-sort por su base y su colisión (rect/polígono/círculo) en Matter.
  _buildYsortObjects() {
    const c = this._cfg
    const data = this.cache.json.get(c.ysort.key)
    if (!data) return

    const atlasKey = c.objects.key
    const tex = this.textures.get(atlasKey)
    for (const [name, f] of Object.entries(data.frames)) {
      if (!tex.has(name)) tex.add(name, 0, f.x, f.y, f.w, f.h)
    }

    // Banda de depth de ysortTop / onTop: por encima del Y-sort normal pero por
    // debajo de las capas de tiles altas (paredes `above`).
    const topBase = this.YSORT_BASE + this.map.heightInPixels + 50

    for (const inst of data.instances) {
      const spr = this.add.image(inst.x, inst.y, atlasKey, inst.name).setOrigin(0, 0)
      const frame = data.frames[inst.name]

      const colls = frame.coll ?? []

      if (inst.onTop) {
        // Objeto de azotea / techo: siempre por encima de todo (sin Y-sort).
        spr.setDepth(this.YSORT_BASE + this.map.heightInPixels + 200)
      } else if (inst.top) {
        // Capa ysortTop: siempre sobre los objetos ysort normales, pero se
        // ordenan entre sí por su base Y.
        let baseY = inst.y + inst.h
        if (colls.length) baseY = inst.y + Math.max(...colls.map(cc => this._collBottom(cc)))
        spr.setDepth(topBase + baseY)
      } else {
        // Base del Y-sort = borde INFERIOR de la colisión (donde el objeto toca
        // el suelo), no el borde de la imagen — que puede tener padding abajo y
        // haría que "tape de más". Si no hay colisión, se usa el borde de imagen.
        let baseY = inst.y + inst.h
        if (colls.length) {
          baseY = inst.y + Math.max(...colls.map(c => this._collBottom(c)))
        }
        spr.setDepth(this.YSORT_BASE + baseY)
      }

      // Colisiones (relativas a la esquina sup-izq de la imagen).
      // El JSON las guarda como {x,y,w,h,[ellipse|polygon|polyline]};
      // _addMatterShape espera {x,y,width,height,...}.
      for (const c of colls) {
        this._addMatterShape({
          x: c.x, y: c.y, width: c.w, height: c.h,
          ellipse: c.ellipse, polygon: c.polygon, polyline: c.polyline,
        }, inst.x, inst.y)
      }
    }
  }

  update() {
    const { player, cursors, wasd } = this
    if (!player) return

    const left  = cursors.left.isDown  || wasd.left.isDown
    const right = cursors.right.isDown || wasd.right.isDown
    const up    = cursors.up.isDown    || wasd.up.isDown
    const down  = cursors.down.isDown  || wasd.down.isDown

    const speed = this._cfg.speed
    let vx = 0, vy = 0
    if (left)  vx = -speed
    else if (right) vx = speed
    if (up)    vy = -speed
    else if (down)  vy = speed
    // Normaliza diagonal para no ir más rápido
    if (vx && vy) { const k = speed / Math.hypot(vx, vy); vx *= k; vy *= k }
    player.setVelocity(vx, vy)

    if (left)       { player.play('walk-left',  true); this.lastDir = 'left'  }
    else if (right) { player.play('walk-right', true); this.lastDir = 'right' }
    else if (up)    { player.play('walk-up',    true); this.lastDir = 'up'    }
    else if (down)  { player.play('walk-down',  true); this.lastDir = 'down'  }
    else {
      // Quieto: animación de reposo mirando la última dirección
      player.play('idle-' + this.lastDir, true)
    }

    // Y-sort del jugador según la Y de sus pies (posición del cuerpo Matter)
    player.setDepth(this.YSORT_BASE + player.y)

    // Cámara (sigue/centra según el tamaño del mapa vs. viewport)
    this._updateCamera()

    // Detección de triggers de entrada (por la posición de los pies)
    this._checkTriggers()
  }

  // Si los pies del jugador entran en un trigger, avisa a React para cambiar de
  // escenario. Guarda la posición para reaparecer aquí al volver.
  _checkTriggers() {
    if (!this._triggers.length) return
    const px = this.player.x, py = this.player.y
    const inside = this._triggers.find(t =>
      px >= t.x && px <= t.x + t.w && py >= t.y && py <= t.y + t.h,
    )
    if (inside && !this._triggeredThisVisit) {
      this._triggeredThisVisit = true
      this.player.setVelocity(0)
      // React maneja el fundido a negro y el cambio de escenario.
      window.dispatchEvent(new CustomEvent('enter-interior', {
        detail: {
          target: inside.target,
          // Posición de retorno: un poco por debajo de la puerta, para no
          // reentrar al trigger al volver.
          returnX: this.player.x,
          returnY: inside.y + inside.h + 24,
        },
      }))
    } else if (!inside) {
      this._triggeredThisVisit = false
    }
  }
}
