import * as Phaser from 'phaser'
import { playSfx } from '../../utils/sfx'
import unit4 from '../../content/grade4/unit4.json'

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
    if (!this.textures.exists('mg-card')) {
      this.load.image('mg-card', '/assets/map/sprites/card.png')
    }
    if (!this.textures.exists('key-e')) {
      this.load.spritesheet('key-e', '/assets/map/sprites/key_e.png', {
        frameWidth: 32, frameHeight: 32,
      })
    }
    if (!this.textures.exists('char-grab')) {
      this.load.spritesheet('char-grab', '/assets/map/sprites/character_grab.png', {
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
    // Agarrar: subir brazos (0-7, frame 7 = arriba) y bajar (8-13). Frontal.
    anims.create({ key: 'grab-up',   frames: anims.generateFrameNumbers('char-grab', { start: 0, end: 7  }), frameRate: 14, repeat: 0 })
    anims.create({ key: 'grab-down', frames: anims.generateFrameNumbers('char-grab', { start: 8, end: 13 }), frameRate: 14, repeat: 0 })

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

    // ── Zonas de minijuego (object layer "minigame_area") ────────
    // Al entrar el jugador, la cámara se fija centrada en esa zona; al salir,
    // vuelve a seguir al jugador.
    this._minigameAreas = this._buildMinigameAreas(map)
    this._activeArea = null
    this._camTransition = 0   // frames restantes de interpolación suave de cámara

    // ── Estaciones de minijuego (object layer "stations") ────────
    this._stations = this._buildStations(map)

    // Valida la convención (áreas + estaciones) y reporta problemas por consola.
    this._validateMinigames()

    this._drawStationLabels()

    // ── Input ────────────────────────────────────────────────────
    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    })
    // Tecla E: interactuar con la estación cercana (agarrar la cartulina)
    this._grabbing = false
    this.input.keyboard.on('keydown-E', () => this._tryGrab())

  }

  // Cámara: sigue al jugador con clamp a los bordes del mapa; si el mapa es más
  // pequeño que el viewport en un eje, centra el mapa en ese eje. (Igual que
  // GameScene: control manual del scroll, correcto con zoom.)
  _updateCamera() {
    const cam   = this.cameras.main
    const zoom  = cam.zoom
    const halfW = cam.width  / (2 * zoom)
    const halfH = cam.height / (2 * zoom)

    let midX, midY
    if (this._activeArea) {
      // Dentro de una zona de minijuego: cámara centrada en el área.
      midX = this._activeArea.cx
      midY = this._activeArea.cy
    } else {
      midX = this._mapW <= halfW * 2
        ? this._mapW / 2
        : Phaser.Math.Clamp(this.player.x, halfW, this._mapW - halfW)
      midY = this._mapH <= halfH * 2
        ? this._mapH / 2
        : Phaser.Math.Clamp(this.player.y, halfH, this._mapH - halfH)
    }

    const targetX = midX - cam.width  / 2
    const targetY = midY - cam.height / 2

    if (this._camInit == null) {
      // Primer frame: sin interpolar (evita un barrido inicial)
      cam.scrollX = targetX
      cam.scrollY = targetY
      this._camInit = true
      this._camFrom = { x: targetX, y: targetY }
      return
    }

    // Durante una transición de zona (entrar/salir) interpolamos desde la
    // posición de inicio hasta el objetivo con una curva suave (easeInOut) que
    // LLEGA exacto al final — así no hay "saltito" al terminar.
    if (this._camTransition > 0) {
      this._camTransition--
      const p = 1 - this._camTransition / this._camTransitionTotal   // 0 → 1
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2 // easeInOutQuad
      cam.scrollX = Phaser.Math.Linear(this._camFrom.x, targetX, e)
      cam.scrollY = Phaser.Math.Linear(this._camFrom.y, targetY, e)
    } else {
      cam.scrollX = targetX
      cam.scrollY = targetY
    }
  }

  // Lee la object layer "minigame_area": rectángulos con `minigame` (+ `id`).
  // Devuelve [{ x, y, w, h, minigame, id, cx, cy }] en píxeles del mundo.
  _buildMinigameAreas(map) {
    const layer = map.getObjectLayer('minigame_area')
    if (!layer) return []
    return layer.objects
      .map(o => {
        const prop = n => (o.properties ?? []).find(p => p.name === n)?.value
        const minigame = prop('minigame')
        if (!minigame) return null
        return {
          x: o.x, y: o.y, w: o.width, h: o.height,
          cx: o.x + o.width / 2, cy: o.y + o.height / 2,
          minigame, id: prop('id') ?? null,
        }
      })
      .filter(Boolean)
  }

  // Nº de estaciones esperadas por tipo de minijuego (para validar el armado).
  static STATIONS_EXPECTED = {
    'listen-choose': 4,
    'listen-point':  4,
    'memory-match':  12,
    'fill-blank':    1,
  }

  // Valida la convención de minijuegos (áreas + estaciones) y reporta por
  // consola cualquier problema de armado en Tiled: atributos faltantes, número
  // de estaciones incorrecto, estaciones fuera de su área, ids que no calzan.
  // Vincula además cada estación a su área (por id + contención) en s.area.
  _validateMinigames() {
    const warn = (msg) => console.warn('[Minigame] ⚠ ' + msg)
    const ok   = (msg) => console.log('[Minigame] ✓ ' + msg)
    const areas = this._minigameAreas
    const stations = this._stations

    if (!areas.length && !stations.length) return   // mapa sin minijuegos

    // Cada estación debe tener station, slot e id
    stations.forEach((s, k) => {
      const at = `station #${k} en (${Math.round(s.cx)},${Math.round(s.cy)})`
      if (!s.station) warn(`${at}: falta la propiedad "station".`)
      if (s.slot == null) warn(`${at}: falta la propiedad "slot".`)
      if (!s.id) warn(`${at}: falta la propiedad "id" (no se puede vincular a un área).`)
    })

    // Cada área debe tener minigame e id
    areas.forEach((a, k) => {
      const at = `minigame_area #${k}`
      if (!a.minigame) warn(`${at}: falta la propiedad "minigame".`)
      if (!a.id) warn(`${at}: falta la propiedad "id".`)
      if (a.minigame && !(a.minigame in MapTestScene.STATIONS_EXPECTED)) {
        warn(`${at} (id "${a.id}"): minigame "${a.minigame}" desconocido.`)
      }
    })

    // Vincula estaciones a su área por id + valida que estén dentro del rect
    for (const a of areas) {
      if (!a.id) continue
      const inside = stations.filter(s => s.id === a.id)
      inside.forEach(s => {
        s.area = a
        const within = s.cx >= a.x && s.cx <= a.x + a.w && s.cy >= a.y && s.cy <= a.y + a.h
        if (!within) warn(`Estación (slot ${s.slot}, id "${s.id}") está FUERA de su área "${a.id}".`)
        if (s.station && a.minigame && s.station !== a.minigame) {
          warn(`Estación (id "${s.id}") tiene station="${s.station}" ≠ minigame="${a.minigame}" del área.`)
        }
      })

      // Número de estaciones esperado
      const expected = MapTestScene.STATIONS_EXPECTED[a.minigame]
      if (expected != null && inside.length !== expected) {
        warn(`Área "${a.id}" (${a.minigame}): se esperaban ${expected} estaciones, hay ${inside.length}.`)
      }
      // Slots correctos (0..expected-1, sin repetir)
      if (expected != null && inside.length === expected) {
        const slots = inside.map(s => Number(s.slot)).sort((x, y) => x - y)
        const wanted = Array.from({ length: expected }, (_, i) => i)
        if (JSON.stringify(slots) !== JSON.stringify(wanted)) {
          warn(`Área "${a.id}": los slots deben ser ${wanted.join(',')} sin repetir; hay ${slots.join(',')}.`)
        } else {
          ok(`Área "${a.id}" (${a.minigame}): ${expected} estaciones con slots correctos.`)
        }
      }
    }

    // Estaciones cuyo id no corresponde a ninguna área
    const areaIds = new Set(areas.map(a => a.id).filter(Boolean))
    stations.forEach(s => {
      if (s.id && !areaIds.has(s.id)) {
        warn(`Estación (slot ${s.slot}) con id "${s.id}" no corresponde a ninguna minigame_area.`)
      }
    })
  }

  // Lee la object layer "stations": rectángulos (mesas) con station/slot/id.
  // Devuelve [{ x, y, w, h, cx, cy, station, slot, id }] ordenados por slot.
  _buildStations(map) {
    const layer = map.getObjectLayer('stations')
    if (!layer) return []
    return layer.objects
      .map(o => {
        const prop = n => (o.properties ?? []).find(p => p.name === n)?.value
        return {
          x: o.x, y: o.y, w: o.width, h: o.height,
          cx: o.x + o.width / 2, cy: o.y + o.height / 2,
          station: prop('station'), slot: prop('slot') ?? 0, id: prop('id') ?? null,
        }
      })
      .filter(s => s.station)
      .sort((a, b) => a.slot - b.slot)
  }

  // Dibuja la cartulina (card.png, 96×64) centrada sobre cada mesa, con Y-sort
  // por su base y colisión. El TEXTO NO se dibuja en Phaser (se ve pixelado por
  // pixelArt+zoom): se renderiza como overlay HTML en React, nítido.
  _drawStationLabels() {
    if (!this._stations.length) return
    const words = unit4.vocabulary.map(v => v.word)
    const CARD_W = 96, CARD_H = 64

    // Animación de la tecla E: frame 0 (sin presionar) ~1s → frame 1 (presionado)
    // ~1s, en loop. Indicador "presioná E".
    if (!this.anims.exists('key-e-pulse')) {
      this.anims.create({
        key: 'key-e-pulse',
        frames: [
          { key: 'key-e', frame: 0, duration: 800 },
          { key: 'key-e', frame: 1, duration: 800 },
        ],
        repeat: -1,
      })
    }

    const keyDepth = this.YSORT_BASE + this.map.heightInPixels + 400
    this._stationKeys = []       // tecla E por estación (se muestra por proximidad)
    this._stationHighlights = [] // resaltado de la cartulina en rango
    this._stationCards = []      // imagen de cada cartulina (para el vuelo al agarrar)
    this._cardHalfW = CARD_W / 2
    this._cardHalfH = CARD_H / 2
    this._stations.forEach((s) => {
      const card = this.add.image(s.cx, s.cy, 'mg-card')
      this._stationCards.push(card)
      // Y-sort por la base de la cartulina (su borde inferior).
      const baseY = s.cy + CARD_H / 2
      card.setDepth(this.YSORT_BASE + baseY)
      // Colisión: rectángulo estático del tamaño de la cartulina.
      this.matter.add.rectangle(s.cx, s.cy, CARD_W, CARD_H, { isStatic: true })

      // Resaltado sobre la cartulina (relleno tenue + borde), oculto hasta que
      // el jugador se acerque. Indica "esta es la que vas a seleccionar".
      // Blanco brillante = resalte tipo "brillo" (neutral, no verde/rojo).
      const hl = this.add.rectangle(s.cx, s.cy, CARD_W, CARD_H, 0xffffff, 0.35)
        .setStrokeStyle(3, 0xffffff, 0.9)
        .setDepth(this.YSORT_BASE + baseY + 0.5)   // justo sobre su cartulina
        .setVisible(false)
      this._stationHighlights.push(hl)

      // Tecla E flotando sobre el borde superior de la cartulina (oculta hasta
      // que el jugador se acerque).
      const key = this.add.sprite(s.cx, s.cy - CARD_H / 2 - 20, 'key-e')
        .setDepth(keyDepth)
        .play('key-e-pulse')
        .setVisible(false)
      this._stationKeys.push(key)
    })

    // Palabra de cada mesa (por ahora, de prueba, por índice de slot)
    this._stationWords = this._stations.map((s, i) => words[i % words.length])
  }

  // Emite a React las palabras + su posición EN PANTALLA (para el overlay HTML).
  // Se llama al entrar a la zona y mientras la cámara esté fija ahí.
  _emitStationLabels() {
    if (!this._stations?.length) return
    const cam = this.cameras.main
    const toScreen = (wx, wy) => ({
      x: (wx - cam.worldView.x) * cam.zoom,
      y: (wy - cam.worldView.y) * cam.zoom,
    })
    // Textos de las cartulinas de la mesa (omite la agarrada: su mesa queda vacía).
    // Si una cartulina se está sacudiendo (respuesta incorrecta), su texto sigue
    // el offset horizontal del shake.
    const labels = []
    this._stations.forEach((s, i) => {
      if (i === this._grabbingIdx) return
      const shakeOff = this._shakeX?.[i] ?? 0
      labels.push({ text: this._stationWords[i], ...toScreen(s.cx + shakeOff, s.cy) })
    })
    // Texto de la copia fantasma que vuela hacia el personaje (si hay agarre).
    if (this._grabFly?.obj?.active) {
      const g = this._grabFly.obj
      labels.push({ text: this._grabFly.text, ...toScreen(g.x, g.y) })
    }
    window.dispatchEvent(new CustomEvent('station-labels', { detail: { labels } }))
  }

  _clearStationLabels() {
    window.dispatchEvent(new CustomEvent('station-labels', { detail: { labels: [] } }))
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

    // Durante el agarre: jugador inmóvil, la animación de grab manda.
    if (this._grabbing) {
      player.setVelocity(0)
      this._updateStationKeys()
      this._updateCamera()
      // Sigue emitiendo los textos de las OTRAS cartulinas (la agarrada se omite)
      if (this._activeArea) this._emitStationLabels()
      return
    }

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

    // Zona de minijuego: fija la cámara al entrar, la libera al salir.
    this._checkMinigameArea()

    // Cámara (sigue/centra según el tamaño del mapa vs. viewport)
    this._updateCamera()

    // Overlay HTML de los textos de las cartulinas: se emite mientras el jugador
    // está en una zona de estaciones (posición en pantalla, sigue la cámara).
    if (this._activeArea && this._stations?.length) this._emitStationLabels()

    // Tecla E: visible solo si el jugador está cerca (≤1 tile) de la cartulina.
    this._updateStationKeys()

    // Detección de triggers de entrada (por la posición de los pies)
    this._checkTriggers()
  }

  // Al presionar E cerca de una estación: el personaje mira al frente y hace la
  // animación de agarre; la cartulina vuela a sus manos (64px sobre él) y
  // desaparece. Bloquea el movimiento durante la secuencia.
  _tryGrab() {
    if (this._grabbing) return
    if (this._nearStation == null || !this._activeArea) return
    const idx = this._nearStation

    // ¿Es la correcta? (TEMP de prueba: "Headache".)
    const correct = this._stationWords[idx] === 'Headache'

    // INCORRECTA: la cartulina se queda en la mesa y hace el efecto de error
    // (rojo pastel + sacudida), sin animación del personaje.
    if (!correct) {
      this._rejectStation(idx)
      return
    }

    // CORRECTA: sonido de acierto + animación de agarre.
    playSfx('correct')

    this._grabbing = true
    const player = this.player
    player.setVelocity(0)
    const prevDir = this.lastDir

    // Ocultar tecla E y resaltado de proximidad.
    this._stationKeys[idx].setVisible(false)
    this._stationHighlights[idx].setVisible(false)

    // La mesa queda VACÍA durante el agarre: ocultamos la cartulina original y
    // omitimos su texto (vía _grabbingIdx). Se restauran al terminar.
    this._stationCards[idx].setVisible(false)
    this._grabbingIdx = idx

    // Personaje al frente + animación de subir brazos
    player.setTexture('char-grab', 0)
    player.play('grab-up')

    // COPIA que vuela (con su texto vía _grabFly) desde la mesa al personaje.
    const src = this._stations[idx]
    const cardDepth = this.YSORT_BASE + this.map.heightInPixels + 500
    const ghost = this.add.image(src.cx, src.cy, 'mg-card').setDepth(cardDepth)
    this._grabFly = { text: this._stationWords[idx], obj: ghost }

    // Feedback de acierto (verde pastel) sobre la carta que vuela.
    const feedback = this.add.rectangle(src.cx, src.cy, 96, 64, 0xb6e8c3, 0.45)
      .setStrokeStyle(3, 0x8fd6a5, 1)
      .setDepth(cardDepth + 1)
    this._grabFly.feedback = feedback

    const flyDur = (8 / 14) * 1000   // ~ lo que dura subir los brazos (8 frames a 14fps)
    this.tweens.add({
      targets: [ghost, feedback],
      x: player.x, y: player.y - 64,
      duration: flyDur, ease: 'Quad.easeOut',
    })

    // Al terminar de subir: pausa 1s con la carta arriba, luego bajar brazos.
    player.once('animationcomplete-grab-up', () => {
      this.time.delayedCall(1000, () => {
        ghost.destroy()          // la copia fantasma desaparece
        feedback.destroy()       // y su resaltado de feedback
        this._grabFly = null
        player.play('grab-down')
      })
    })

    // Al terminar de bajar: restaurar la cartulina de la mesa, volver al idle en
    // la dirección previa y desbloquear.
    player.once('animationcomplete-grab-down', () => {
      this._stationCards[idx].setVisible(true)   // reaparece en la mesa
      this._grabbingIdx = null
      this.lastDir = prevDir
      player.setTexture(CHAR_IDLE, 0)
      player.play('idle-' + prevDir)
      this._grabbing = false
    })
  }

  // Respuesta INCORRECTA: la cartulina se queda en la mesa, se tiñe de rojo
  // pastel y se sacude (como el feedback de error de los minijuegos de UI).
  _rejectStation(idx) {
    if (this._rejecting?.[idx]) return
    this._rejecting = this._rejecting || {}
    this._rejecting[idx] = true

    const s = this._stations[idx]
    const card = this._stationCards[idx]
    const cardDepth = this.YSORT_BASE + this.map.heightInPixels + 500

    // Overlay rojo pastel sobre la cartulina.
    const flash = this.add.rectangle(s.cx, s.cy, 96, 64, 0xf5c2bb, 0.55)
      .setStrokeStyle(3, 0xe89a90, 1)
      .setDepth(cardDepth)

    // Sacudida horizontal (~0.45s). Un solo tween con offset que va y vuelve
    // varias veces; el texto (overlay HTML) sigue esta X vía _shakeX[idx].
    const baseX = s.cx
    this._shakeX = this._shakeX || {}
    this.tweens.add({
      targets: { off: -3 },
      off: 3,
      duration: 85,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: 4,
      onUpdate: (tw, t) => {
        const off = t.off
        card.x = baseX + off
        flash.x = baseX + off
        this._shakeX[idx] = off
      },
      onComplete: () => {
        card.x = baseX
        flash.destroy()
        delete this._shakeX[idx]
        this._rejecting[idx] = false
      },
    })
    playSfx('wrong')
  }

  // Muestra la tecla E sobre una estación cuando el jugador está a ≤1 tile del
  // rectángulo de su cartulina (96×64). Guarda la estación en rango para la
  // interacción con E.
  _updateStationKeys() {
    if (!this._stationKeys?.length) return
    const NEAR = 32   // 1 tile de margen alrededor de la cartulina
    const px = this.player.x, py = this.player.y
    this._nearStation = null
    this._stations.forEach((s, i) => {
      // Distancia del jugador al rectángulo de la cartulina (expandido NEAR)
      const dx = Math.max(Math.abs(px - s.cx) - this._cardHalfW, 0)
      const dy = Math.max(Math.abs(py - s.cy) - this._cardHalfH, 0)
      const near = dx <= NEAR && dy <= NEAR
      // Durante el agarre, no re-mostrar la tecla/resaltado (ni de la agarrada).
      const show = near && !!this._activeArea && !this._grabbing
      this._stationKeys[i].setVisible(show)
      this._stationHighlights[i].setVisible(show)
      if (show) this._nearStation = i
    })
  }

  // Detecta si el jugador está dentro de una zona de minijuego y activa/desactiva
  // el enfoque de cámara. Notifica a React al entrar/salir (para la lógica del
  // minijuego, que se conectará después).
  _checkMinigameArea() {
    if (!this._minigameAreas.length) return
    const px = this.player.x, py = this.player.y
    const inside = this._minigameAreas.find(a =>
      px >= a.x && px <= a.x + a.w && py >= a.y && py <= a.y + a.h,
    ) ?? null

    if (inside === this._activeArea) return   // sin cambios

    // Cambió el estado de zona → arranca la interpolación suave de cámara
    // (~0.5 s a 60 fps), desde la posición actual hacia el nuevo objetivo.
    const cam = this.cameras.main
    this._camFrom = { x: cam.scrollX, y: cam.scrollY }
    this._camTransitionTotal = 30
    this._camTransition = 30

    if (inside) {
      this._activeArea = inside
      window.dispatchEvent(new CustomEvent('minigame-area-enter', {
        detail: { minigame: inside.minigame, id: inside.id },
      }))
    } else {
      const left = this._activeArea
      this._activeArea = null
      this._clearStationLabels()   // ocultar textos HTML al salir
      window.dispatchEvent(new CustomEvent('minigame-area-exit', {
        detail: { minigame: left?.minigame, id: left?.id },
      }))
    }
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
