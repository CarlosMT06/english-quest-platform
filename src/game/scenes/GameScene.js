import * as Phaser from 'phaser'

const SPEED = 180

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene')
  }

  preload() {
    this.load.tilemapTiledJSON('map',        '/assets/map/map.json')
    this.load.image('spritefusion',           '/assets/map/spritesheet.png')
    this.load.spritesheet('character',        '/assets/map/sprites/character.png', {
      frameWidth: 32, frameHeight: 64,
    })
    this.load.spritesheet('doctor',           '/assets/map/sprites/doctor.png', {
      frameWidth: 32, frameHeight: 64,
    })
    this.load.spritesheet('camera-anim',     '/assets/map/sprites/camera.png', {
      frameWidth: 32, frameHeight: 32,
    })
    this.load.image('dialog-box',             '/assets/ui/dialog-box.png')
    this.load.spritesheet('face-doctor',      '/assets/ui/faces/doctor.png', {
      frameWidth: 64, frameHeight: 64,
    })
    this.load.spritesheet('door-anim',       '/assets/map/sprites/door.png', {
      frameWidth: 64, frameHeight: 96,
    })
    this.load.spritesheet('door2-anim',      '/assets/map/sprites/door2.png', {
      frameWidth: 64, frameHeight: 96,
    })
    this.load.spritesheet('door3-anim',      '/assets/map/sprites/door3.png', {
      frameWidth: 64, frameHeight: 96,
    })
  }

  create() {
    const map     = this.make.tilemap({ key: 'map' })
    const tileset = map.addTilesetImage('spritefusion', 'spritefusion')

    // ── Capas en orden de profundidad ────────────────────────────
    const layerFloor    = map.createLayer('Floor',        tileset).setDepth(0)
    const layerWalls    = map.createLayer('Walls',        tileset).setDepth(1)
    const layerShadows  = map.createLayer('WallsShadows', tileset).setDepth(2)
    // Jugador va en depth 3 (entre sombras y objetos)
    const layerObj1     = map.createLayer('Objects1',     tileset).setDepth(4)
    const layerObj2     = map.createLayer('Objects2',     tileset).setDepth(5)
    const layerObj3     = map.createLayer('Objects3',     tileset).setDepth(6)
    const layerObj4     = map.createLayer('Objects4',     tileset).setDepth(7)

    // Referencia a todas las capas (la cámara UI debe ignorarlas)
    this.mapLayers = [layerFloor, layerWalls, layerShadows, layerObj1, layerObj2, layerObj3, layerObj4]

    // ── Colisiones ───────────────────────────────────────────────
    const collideLayers = [layerWalls, layerObj1, layerObj2, layerObj3, layerObj4]
    collideLayers.forEach(l => l.setCollisionByExclusion([-1]))

    // ── Límites del mundo según el tamaño del mapa ───────────────
    this.mapWidth  = map.widthInPixels
    this.mapHeight = map.heightInPixels
    this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight)

    // Bounding box real de lo dibujado (capa Floor = forma del cuarto).
    // El grid del mapa puede tener zonas vacías (ej. la salida al vacío)
    // que no deben contarse para centrar visualmente el contenido.
    const content = this._getContentBounds(map, layerFloor)
    this.contentX      = content.x
    this.contentY      = content.y
    this.contentWidth  = content.width
    this.contentHeight = content.height

    // Color de fondo de la cámara (se ve si el mapa es más chico que el lienzo)
    this.cameras.main.setBackgroundColor('#1a1a1a')

    // Zoom del mundo (compensa el tamaño nativo tras pasar a Scale.RESIZE)
    this.cameras.main.setZoom(1.5)

    // ── Animaciones del personaje ────────────────────────────────
    this._createCharacterAnims()

    // ── Elementos animados ───────────────────────────────────────
    this._createProps(map)

    // ── Jugador ──────────────────────────────────────────────────
    this._createPlayer(map)
    this._createInput()

    // Colisión jugador ↔ capas
    collideLayers.forEach(l => this.physics.add.collider(this.player, l))

    // ── HUD: recuadro de diálogo centrado abajo ──────────────────
    const margin = 16
    this.dialogBox = this.add
      .image(this.scale.width / 2, this.scale.height - margin, 'dialog-box')
      .setOrigin(0.5, 1)        // centrado en X, anclado al borde inferior
      .setDepth(30)             // sin escalar: tamaño natural del PNG

    // Rostro animado sobre el recuadro, en su posición (64, 64)
    this.anims.create({
      key:       'face-doctor-talk',
      frames:    this.anims.generateFrameNumbers('face-doctor', { start: 0, end: 9 }),
      frameRate: 8,
      repeat:    -1,
    })
    const boxTL = this.dialogBox.getTopLeft()
    this.dialogFace = this.add
      .sprite(boxTL.x + 32, boxTL.y + 32, 'face-doctor')
      .setOrigin(0, 0)          // esquina sup-izq del rostro en (32, 32) del recuadro
      .setScale(2)              // 64×64 → 128×128
      .setDepth(31)
      .play('face-doctor-talk')

    // Texto sobre el recuadro. TX en celda 6 (192 px); TY un poco arriba
    // para que las 2 líneas (con más interlineado) queden centradas en Y.
    const TX = 6 * 32, TY = 60
    const availWidth = this.dialogBox.width - TX - 48   // ancho útil (≈ 22 chars a 25px)
    this.dialogText = this.add
      .text(boxTL.x + TX, boxTL.y + TY, '', {
        fontFamily: 'Nunito', fontSize: '25px', color: '#2D2016',
        wordWrap: { width: availWidth },   // corta por espacios, no parte palabras
        maxLines: 2,                        // máximo 2 líneas por página
        lineSpacing: 12,                    // más espacio entre líneas
      })
      .setOrigin(0, 0)
      .setDepth(31)

    // Indicador "▶" (esquina inferior derecha del recuadro) — parpadea
    this.dialogHint = this.add
      .text(boxTL.x + this.dialogBox.width - 20, boxTL.y + this.dialogBox.height - 14, '▶', {
        fontFamily: 'Nunito', fontSize: '26px', color: '#2D2016',
      })
      .setOrigin(1, 1)
      .setDepth(31)
      .setVisible(false)
    this.tweens.add({
      targets: this.dialogHint, alpha: 0.2,
      duration: 500, yoyo: true, repeat: -1,
    })

    // ── Cámara de UI: sin zoom ni scroll (solo para el HUD) ──────
    // La cámara principal ignora el HUD; la de UI ignora todo el mundo.
    const uiObjects = [this.dialogBox, this.dialogFace, this.dialogText, this.dialogHint]
    const uiSet = new Set(uiObjects)
    const worldObjects = [
      ...this.children.list.filter(o => !uiSet.has(o)),
      ...this.mapLayers,   // por si las TilemapLayer no están en children.list
    ]
    this.uiCamera = this.cameras.add()   // tamaño del juego, zoom 1, scroll 0
    this.uiCamera.ignore(worldObjects)
    this.cameras.main.ignore(uiObjects)

    // Con Scale.RESIZE: redimensionar la cámara UI y reubicar el HUD
    this.scale.on('resize', (gameSize) => {
      this.uiCamera.setSize(gameSize.width, gameSize.height)
      this.dialogBox.setPosition(gameSize.width / 2, gameSize.height - margin)
      const tl = this.dialogBox.getTopLeft()
      this.dialogFace.setPosition(tl.x + 32, tl.y + 32)
      this.dialogText.setPosition(tl.x + TX, tl.y + TY)
      this.dialogHint.setPosition(tl.x + this.dialogBox.width - 20, tl.y + this.dialogBox.height - 14)
    })

    // El recuadro empieza oculto; se abre al hablar con un NPC
    this.dialogHud = [this.dialogBox, this.dialogFace, this.dialogText, this.dialogHint]
    this.dialogOpen = false
    this.dialogHud.forEach(o => o.setVisible(false))

    // Espacio avanza de página (y cierra el recuadro en la última)
    this.input.keyboard.on('keydown-SPACE', () => this._nextDialogPage())

    // La cámara se controla manualmente en update() para soportar tanto
    // mapas grandes (scroll siguiendo al jugador) como mapas pequeños
    // (mapa centrado, sin recortes ni bordes vacíos a un solo lado)
  }

  // Acepta un texto (se pagina solo cada 2 líneas) o un array de frases
  // (cada frase = su propio recuadro; si una es larga igual se pagina).
  setDialogText(text) {
    const messages = Array.isArray(text) ? text : [text]
    this.dialogPages = []
    for (const msg of messages) {
      const lines = this.dialogText.getWrappedText(msg)
      for (let i = 0; i < lines.length; i += 2) {
        this.dialogPages.push(lines.slice(i, i + 2).join('\n'))
      }
    }
    if (this.dialogPages.length === 0) this.dialogPages = ['']
    this.dialogPage = 0
    this._showDialogPage()
  }

  _showDialogPage() {
    this.dialogText.setText(this.dialogPages[this.dialogPage])
    const hayMas = this.dialogPage < this.dialogPages.length - 1
    this.dialogHint.setVisible(hayMas)
  }

  // Abre el recuadro con las frases dadas (texto o array de frases)
  openDialog(text) {
    this.dialogOpen = true
    this.doctorIndicator.setVisible(false)
    this.dialogBox.setVisible(true)
    this.dialogFace.setVisible(true)
    this.dialogText.setVisible(true)
    this.setDialogText(text)   // muestra la 1ª página y ajusta el indicador
  }

  closeDialog() {
    this.dialogOpen = false
    this.dialogHud.forEach(o => o.setVisible(false))
  }

  _nextDialogPage() {
    if (!this.dialogOpen) return
    if (this.dialogPage < this.dialogPages.length - 1) {
      this.dialogPage++
      this._showDialogPage()
    } else {
      this.closeDialog()   // en la última página, espacio cierra el recuadro
    }
  }

  _createCharacterAnims() {
    const { anims } = this
    anims.create({ key: 'walk-right', frames: anims.generateFrameNumbers('character', { start: 0,  end: 5  }), frameRate: 10, repeat: -1 })
    anims.create({ key: 'walk-up',    frames: anims.generateFrameNumbers('character', { start: 6,  end: 11 }), frameRate: 10, repeat: -1 })
    anims.create({ key: 'walk-left',  frames: anims.generateFrameNumbers('character', { start: 12, end: 17 }), frameRate: 10, repeat: -1 })
    anims.create({ key: 'walk-down',  frames: anims.generateFrameNumbers('character', { start: 18, end: 23 }), frameRate: 10, repeat: -1 })
  }

  _createPlayer(map) {
    this.lastDir = 'down'

    this.player = this.physics.add
      .sprite(
        7 * map.tileWidth  + map.tileWidth  / 2,
        18 * map.tileHeight + map.tileHeight / 2,
        'character', 18,
      )
      .setDepth(9)
      .setCollideWorldBounds(true)

    // Hitbox reducido al área de los pies (el sprite mide 32×64)
    this.player.body.setSize(24, 20).setOffset(4, 44)
  }

  _createProps(map) {
    const tw = map.tileWidth
    const th = map.tileHeight

    // ── Cámara de seguridad ──────────────────────────────────────
    this.anims.create({
      key:       'camera-play',
      frames:    this.anims.generateFrameNumbers('camera-anim', { start: 0, end: 9 }),
      frameRate: 8,
      repeat:    -1,
    })

    this.add.sprite(7 * tw + tw / 2, 6 * th + th / 2, 'camera-anim')
      .setDepth(6)
      .play('camera-play')

    // ── Puerta ───────────────────────────────────────────────────
    // Apertura: índice 0 (cerrada) → 1,2,3 (abriéndose) → 4 (abierta)
    this.anims.create({
      key:       'door-open',
      frames:    this.anims.generateFrameNumbers('door-anim', { start: 0, end: 4 }),
      frameRate: 10,
      repeat:    0,
    })
    // Cierre: índices 5,6,7 (cerrándose); al terminar se salta manualmente al 0
    this.anims.create({
      key:       'door-close',
      frames:    this.anims.generateFrameNumbers('door-anim', { frames: [5, 6, 7] }),
      frameRate: 10,
      repeat:    0,
    })

    this.doorState = 'closed'
    this.doorRange = 3 * tw

    this.door = this.add
      .sprite(11 * tw + tw / 2, 8 * th + th / 2, 'door-anim', 0)
      .setDepth(8)

    this.door.on('animationcomplete', (anim) => {
      if (anim.key === 'door-open') {
        this.doorState = 'open'
      } else if (anim.key === 'door-close') {
        this.door.setFrame(0)
        this.doorState = 'closed'
      }
    })

    // ── Puerta 2 ─────────────────────────────────────────────────
    this.anims.create({
      key:       'door2-open',
      frames:    this.anims.generateFrameNumbers('door2-anim', { start: 0, end: 4 }),
      frameRate: 10,
      repeat:    0,
    })
    this.anims.create({
      key:       'door2-close',
      frames:    this.anims.generateFrameNumbers('door2-anim', { frames: [5, 6, 7] }),
      frameRate: 10,
      repeat:    0,
    })

    this.door2State = 'closed'

    this.door2 = this.add
      .sprite(10 * tw, 13 * th + th / 2, 'door2-anim', 0)
      .setDepth(8)

    this.door2.on('animationcomplete', (anim) => {
      if (anim.key === 'door2-open') {
        this.door2State = 'open'
      } else if (anim.key === 'door2-close') {
        this.door2.setFrame(0)
        this.door2State = 'closed'
      }
    })

    // ── Puerta 3 ─────────────────────────────────────────────────
    this.anims.create({
      key:       'door3-open',
      frames:    this.anims.generateFrameNumbers('door3-anim', { start: 0, end: 5 }),
      frameRate: 10,
      repeat:    0,
    })
    this.anims.create({
      key:       'door3-close',
      frames:    this.anims.generateFrameNumbers('door3-anim', { frames: [6, 7, 8, 9] }),
      frameRate: 10,
      repeat:    0,
    })

    this.door3State = 'closed'

    this.door3 = this.add
      .sprite(10 * tw, 2 * th + th / 2, 'door3-anim', 0)
      .setDepth(8)

    this.door3.on('animationcomplete', (anim) => {
      if (anim.key === 'door3-open') {
        this.door3State = 'open'
      } else if (anim.key === 'door3-close') {
        this.door3.setFrame(0)
        this.door3State = 'closed'
      }
    })

    // ── Doctor (NPC) ─────────────────────────────────────────────
    this.anims.create({
      key:       'doctor-far',
      frames:    this.anims.generateFrameNumbers('doctor', { start: 18, end: 23 }),
      frameRate: 6,
      repeat:    -1,
    })
    this.anims.create({
      key:       'doctor-near',
      frames:    this.anims.generateFrameNumbers('doctor', { start: 0, end: 5 }),
      frameRate: 6,
      repeat:    -1,
    })

    this.doctorState = 'far'

    this.doctor = this.add
      .sprite(4 * tw + tw / 2, 4 * th + th / 2, 'doctor', 18)
      .setDepth(9)
      .play('doctor-far')

    // Botón "E" sobre la cabeza del doctor (se muestra en proximidad)
    this.doctorIndicator = this.add
      .text(this.doctor.x, this.doctor.y - 40, 'E', {
        fontFamily: 'Nunito', fontSize: '14px', fontStyle: 'bold',
        color: '#ffffff', backgroundColor: '#333333',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5, 1)
      .setDepth(10)
      .setVisible(false)
  }

  // Recorre la capa dada y devuelve el rectángulo (en píxeles) que
  // envuelve únicamente las celdas con contenido (índice ≠ -1).
  _getContentBounds(map, layer) {
    let minX = map.width, minY = map.height, maxX = -1, maxY = -1

    layer.layer.data.forEach((row, y) => {
      row.forEach((tile, x) => {
        if (tile.index === -1) return
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      })
    })

    if (maxX < minX) {
      return { x: 0, y: 0, width: map.widthInPixels, height: map.heightInPixels }
    }

    return {
      x:      minX * map.tileWidth,
      y:      minY * map.tileHeight,
      width:  (maxX - minX + 1) * map.tileWidth,
      height: (maxY - minY + 1) * map.tileHeight,
    }
  }

  _createInput() {
    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    })
    this.keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E)
  }

  update() {
    const { player, cursors, wasd } = this

    // Durante el diálogo: jugador inmóvil (espacio maneja el avance)
    if (this.dialogOpen) {
      player.setVelocity(0)
      player.anims.stop()
      player.setFrame({ left: 12, right: 0, up: 6, down: 18 }[this.lastDir])
      this._updateCamera()
      return
    }

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

    // Animación según dirección; idle = primer frame de la última dirección
    if (left)       { player.play('walk-left',  true); this.lastDir = 'left'  }
    else if (right) { player.play('walk-right', true); this.lastDir = 'right' }
    else if (up)    { player.play('walk-up',    true); this.lastDir = 'up'    }
    else if (down)  { player.play('walk-down',  true); this.lastDir = 'down'  }
    else {
      player.anims.stop()
      player.setFrame({ left: 12, right: 0, up: 6, down: 18 }[this.lastDir])
    }

    this._updateDoor()
    this._updateDoor2()
    this._updateDoor3()
    this._updateDoctor()
    this._updateCamera()
  }

  _updateDoor() {
    const dist = Phaser.Math.Distance.Between(
      this.player.x, this.player.y,
      this.door.x,   this.door.y,
    )

    if (dist <= this.doorRange && this.doorState === 'closed') {
      this.doorState = 'opening'
      this.door.play('door-open')
    } else if (dist > this.doorRange && this.doorState === 'open') {
      this.doorState = 'closing'
      this.door.play('door-close')
    }
  }

  _updateDoor2() {
    const dist = Phaser.Math.Distance.Between(
      this.player.x, this.player.y,
      this.door2.x,  this.door2.y,
    )

    if (dist <= this.doorRange && this.door2State === 'closed') {
      this.door2State = 'opening'
      this.door2.play('door2-open')
    } else if (dist > this.doorRange && this.door2State === 'open') {
      this.door2State = 'closing'
      this.door2.play('door2-close')
    }
  }

  _updateDoor3() {
    const dist = Phaser.Math.Distance.Between(
      this.player.x, this.player.y,
      this.door3.x,  this.door3.y,
    )

    if (dist <= this.doorRange && this.door3State === 'closed') {
      this.door3State = 'opening'
      this.door3.play('door3-open')
    } else if (dist > this.doorRange && this.door3State === 'open') {
      this.door3State = 'closing'
      this.door3.play('door3-close')
    }
  }

  _updateDoctor() {
    const dist = Phaser.Math.Distance.Between(
      this.player.x, this.player.y,
      this.doctor.x, this.doctor.y,
    )
    const inRange = dist <= this.doorRange

    if (inRange && this.doctorState === 'far') {
      this.doctorState = 'near'
      this.doctor.play('doctor-near')
    } else if (!inRange && this.doctorState === 'near') {
      this.doctorState = 'far'
      this.doctor.play('doctor-far')
    }

    // Indicador "E" visible solo cerca y sin diálogo abierto
    this.doctorIndicator.setVisible(inRange && !this.dialogOpen)

    // Abrir el diálogo al presionar E estando cerca
    if (inRange && !this.dialogOpen && Phaser.Input.Keyboard.JustDown(this.keyE)) {
      this.openDialog([
        'Oh no!',
        'The hospital is very busy today.',
        'Can you help me?',
      ])
    }
  }

  // Por eje: si el mapa es más grande que el área visible, la cámara sigue
  // al jugador (con clamp a los bordes del mapa). Si es más chico, el mapa
  // queda centrado. Se razona con el CENTRO de la cámara y el viewport ya
  // dividido por el zoom (el área de mundo visible = lienzo / zoom).
  _updateCamera() {
    const cam   = this.cameras.main
    const zoom  = cam.zoom
    const halfW = cam.width  / (2 * zoom)   // media anchura visible (en mundo)
    const halfH = cam.height / (2 * zoom)   // media altura visible (en mundo)

    // Centro de cámara en X
    const midX = this.mapWidth <= halfW * 2
      ? this.contentX + this.contentWidth / 2                        // mapa centrado
      : Phaser.Math.Clamp(this.player.x, halfW, this.mapWidth - halfW)

    // Centro de cámara en Y
    const midY = this.mapHeight <= halfH * 2
      ? this.contentY + this.contentHeight / 2
      : Phaser.Math.Clamp(this.player.y, halfH, this.mapHeight - halfH)

    // scroll = centro − medio lienzo (el zoom escala alrededor del centro)
    cam.scrollX = midX - cam.width  / 2
    cam.scrollY = midY - cam.height / 2
  }
}
