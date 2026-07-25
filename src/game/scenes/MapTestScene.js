import * as Phaser from 'phaser'

// Escena de prueba del mapa de Tiled: jugador movible + colisiones por-tile.
//
// El mapa usa un atlas empaquetado (packed-tiles.png) generado por
// scripts/optimize-map.mjs: un único tileset con solo los tiles usados y sus
// colisiones (rectángulos dibujados en el Collision Editor de Tiled).

const PACKED = 'packed-tiles'      // tileset empaquetado
const CHAR   = 'character'          // sprite del jugador (32×64)
const SPEED  = 180                  // velocidad del jugador
const SPAWN  = { x: 50, y: 50 }       // tile de aparición
const ZOOM   = 2                    // acercamiento de la cámara

export class MapTestScene extends Phaser.Scene {
  constructor() {
    super('MapTestScene')
  }

  preload() {
    this._t0 = performance.now()
    this.load.on('complete', () => {
      console.log(`[MapTest] descarga+decodificación: ${(performance.now() - this._t0).toFixed(0)} ms`)
    })
    this.load.tilemapTiledJSON('testmap', '/assets/maps/map.optimized.tmj')
    this.load.image(PACKED, `/assets/maps/${PACKED}.png`)
    this.load.spritesheet(CHAR, '/assets/map/sprites/character.png', {
      frameWidth: 32, frameHeight: 64,
    })
  }

  create() {
    const tCreate = performance.now()
    const map = this.make.tilemap({ key: 'testmap' })
    this.map = map

    const tileset = map.addTilesetImage(PACKED, PACKED)

    // ── Capas de tiles en orden, con profundidad ─────────────────
    // El jugador irá en depth PLAYER_DEPTH. Las capas hasta "Edificios1"
    // van por DEBAJO (el jugador las pisa); las siguientes por ENCIMA
    // (el jugador pasa "detrás" de ellas: edificios altos, decoración...).
    const ABOVE_FROM = 'Edificios2'   // primera capa que se dibuja SOBRE el jugador
    const PLAYER_DEPTH = 500
    let abovePlayer = false
    const tileLayers = []
    map.layers.forEach((layerData, i) => {
      const layer = map.createLayer(layerData.name, [tileset], 0, 0)
      if (!layer) return
      layer.setCullPadding(2, 2)
      if (layerData.name === ABOVE_FROM) abovePlayer = true
      // Debajo: depths 0..N crecientes. Encima: por encima del jugador.
      layer.setDepth(abovePlayer ? PLAYER_DEPTH + 1 + i : i)
      tileLayers.push(layer)
    })

    // ── Colisiones por FORMA (no por tile completo) ──────────────
    // El Collision Editor de Tiled guarda, por cada tile, uno o varios
    // rectángulos (a veces parciales) o polylines. Creamos un cuerpo estático
    // por cada forma en su posición/tamaño reales, para respetar las colisiones
    // ajustadas (ej. solo la base de un árbol), no todo el tile.
    this.collisionBodies = this.physics.add.staticGroup()
    this._buildTileCollisions(map, tileLayers)

    // El jugador se dibuja por encima de las primeras capas del suelo
    // pero por debajo de las capas altas (árboles, edificios). Depth intermedio.
    this.cameras.main.setBackgroundColor('#1d232b')

    const mapW = map.widthInPixels
    const mapH = map.heightInPixels
    this.physics.world.setBounds(0, 0, mapW, mapH)
    this.cameras.main.setBounds(0, 0, mapW, mapH)

    // ── Animaciones del personaje (idénticas a GameScene) ────────
    const { anims } = this
    anims.create({ key: 'walk-right', frames: anims.generateFrameNumbers(CHAR, { start: 0,  end: 5  }), frameRate: 10, repeat: -1 })
    anims.create({ key: 'walk-up',    frames: anims.generateFrameNumbers(CHAR, { start: 6,  end: 11 }), frameRate: 10, repeat: -1 })
    anims.create({ key: 'walk-left',  frames: anims.generateFrameNumbers(CHAR, { start: 12, end: 17 }), frameRate: 10, repeat: -1 })
    anims.create({ key: 'walk-down',  frames: anims.generateFrameNumbers(CHAR, { start: 18, end: 23 }), frameRate: 10, repeat: -1 })

    // ── Jugador ──────────────────────────────────────────────────
    this.lastDir = 'down'
    this.player = this.physics.add
      .sprite(
        SPAWN.x * map.tileWidth  + map.tileWidth  / 2,
        SPAWN.y * map.tileHeight + map.tileHeight / 2,
        CHAR, 18,
      )
      .setDepth(500)
      .setCollideWorldBounds(true)
    // Hitbox reducido al área de los pies (sprite 32×64)
    this.player.body.setSize(24, 20).setOffset(4, 44)

    // Colisión jugador ↔ cuerpos de colisión (formas por tile)
    this.physics.add.collider(this.player, this.collisionBodies)

    // ── Cámara sigue al jugador ──────────────────────────────────
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)
    this.cameras.main.setZoom(ZOOM)

    // ── Input ────────────────────────────────────────────────────
    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    })

    // Texto de ayuda fijo
    this.add.text(10, 10,
      'Mapa de prueba · Flechas/WASD: mover',
      { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff',
        backgroundColor: '#000000aa', padding: { x: 8, y: 5 } }
    ).setScrollFactor(0).setDepth(1000)

    console.log(`[MapTest] ${map.width}x${map.height} tiles · ${map.layers.length} capas · ${this._bodyCount} cuerpos de colisión`)
    console.log(`[MapTest] create() (parse + crear capas): ${(performance.now() - tCreate).toFixed(0)} ms`)
  }

  // Crea un cuerpo estático por cada forma de colisión dibujada en Tiled.
  _buildTileCollisions(map, tileLayers) {
    const TW = map.tileWidth, TH = map.tileHeight
    let bodies = 0, approx = 0

    for (const layer of tileLayers) {
      layer.forEachTile(tile => {
        const shapes = tile.tileset?.getTileCollisionGroup(tile.index)
        if (!shapes || !shapes.objects || !shapes.objects.length) return

        // Origen del tile en píxeles del mundo
        const ox = tile.pixelX
        const oy = tile.pixelY

        for (const obj of shapes.objects) {
          let rx, ry, rw, rh
          if (obj.rectangle || (obj.width > 0 && obj.height > 0 && !obj.polygon && !obj.polyline && !obj.ellipse)) {
            // Rectángulo (completo o parcial) — respeta la forma exacta
            rx = obj.x; ry = obj.y; rw = obj.width; rh = obj.height
          } else if (obj.polygon || obj.polyline) {
            // Diagonal/línea: Arcade no la soporta → bounding box aproximado
            const pts = obj.polygon || obj.polyline
            const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
            rx = obj.x + Math.min(...xs)
            ry = obj.y + Math.min(...ys)
            rw = Math.max(...xs) - Math.min(...xs)
            rh = Math.max(...ys) - Math.min(...ys)
            approx++
          } else {
            continue
          }
          if (rw <= 0 || rh <= 0) continue

          // Cuerpo estático en la posición/tamaño reales de la forma
          const body = this.add.rectangle(ox + rx + rw / 2, oy + ry + rh / 2, rw, rh)
          this.physics.add.existing(body, true)
          this.collisionBodies.add(body)
          bodies++
        }
      }, this, 0, 0, map.width, map.height)
    }

    this._bodyCount = bodies
    if (approx) console.log(`[MapTest] ${approx} formas diagonales aproximadas a rectángulo`)
  }

  update() {
    const { player, cursors, wasd } = this
    if (!player) return

    const left  = cursors.left.isDown  || wasd.left.isDown
    const right = cursors.right.isDown || wasd.right.isDown
    const up    = cursors.up.isDown    || wasd.up.isDown
    const down  = cursors.down.isDown  || wasd.down.isDown

    player.setVelocity(0)
    if (left)       player.setVelocityX(-SPEED)
    else if (right) player.setVelocityX(SPEED)
    if (up)         player.setVelocityY(-SPEED)
    else if (down)  player.setVelocityY(SPEED)

    if ((left || right) && (up || down)) {
      player.body.velocity.normalize().scale(SPEED)
    }

    if (left)       { player.play('walk-left',  true); this.lastDir = 'left'  }
    else if (right) { player.play('walk-right', true); this.lastDir = 'right' }
    else if (up)    { player.play('walk-up',    true); this.lastDir = 'up'    }
    else if (down)  { player.play('walk-down',  true); this.lastDir = 'down'  }
    else {
      player.anims.stop()
      player.setFrame({ left: 12, right: 0, up: 6, down: 18 }[this.lastDir])
    }
  }
}
