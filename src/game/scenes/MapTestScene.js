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

// Corazones (fallos permitidos) por dificultad para Listen & Choose.
// La dificultad está fija en 'medium' por ahora.
const HEARTS_BY_DIFFICULTY = { easy: 4, medium: 3, hard: 2 }
const DIFFICULTY = 'medium'

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
    if (!this.textures.exists('npc-doctor')) {
      this.load.spritesheet('npc-doctor', '/assets/map/sprites/doctor.png', {
        frameWidth: 32, frameHeight: 64,
      })
    }
    if (!this.textures.exists('dialog-box')) {
      this.load.image('dialog-box', '/assets/ui/dialog-box.png')
    }
    if (!this.textures.exists('round-box')) {
      this.load.image('round-box', '/assets/ui/round-box.png')
    }
    if (!this.textures.exists('confirm-box')) {
      this.load.image('confirm-box', '/assets/ui/confirm-box.png')
    }
    if (!this.textures.exists('heart')) {
      this.load.image('heart', '/assets/ui/heart.png')
    }
    if (!this.textures.exists('face-doctor')) {
      this.load.spritesheet('face-doctor', '/assets/ui/faces/doctor.png', {
        frameWidth: 64, frameHeight: 64,
      })
    }
    if (!this.textures.exists('face-main')) {
      this.load.spritesheet('face-main', '/assets/ui/faces/main.png', {
        frameWidth: 64, frameHeight: 64,
      })
    }
    if (!this.textures.exists('note')) {
      this.load.spritesheet('note', '/assets/map/sprites/note.png', {
        frameWidth: 32, frameHeight: 48,
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
    // Doctor NPC: idle en las 4 direcciones (mismo layout que el personaje).
    if (this.textures.exists('npc-doctor')) {
      anims.create({ key: 'doctor-right', frames: anims.generateFrameNumbers('npc-doctor', { start: 0,  end: 5  }), frameRate: 6, repeat: -1 })
      anims.create({ key: 'doctor-up',    frames: anims.generateFrameNumbers('npc-doctor', { start: 6,  end: 11 }), frameRate: 6, repeat: -1 })
      anims.create({ key: 'doctor-left',  frames: anims.generateFrameNumbers('npc-doctor', { start: 12, end: 17 }), frameRate: 6, repeat: -1 })
      anims.create({ key: 'doctor-down',  frames: anims.generateFrameNumbers('npc-doctor', { start: 18, end: 23 }), frameRate: 6, repeat: -1 })
    }

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

    // Overlay de oscurecido: cubre TODO el mundo menos la zona del minijuego,
    // para demarcar el área de juego (útil sobre todo en espacios abiertos).
    // Se dibuja por debajo del HUD pero encima del mundo. Oculto hasta jugar.
    this._darkOverlay = this.add.graphics()
      .setDepth(this.YSORT_BASE + this.map.heightInPixels + 350)
      .setVisible(false)
    this._activeArea = null
    this._camTransition = 0   // frames restantes de interpolación suave de cámara

    // ── Estaciones de minijuego (object layer "stations") ────────
    this._stations = this._buildStations(map)
    // Las cartulinas se muestran solo tras hablar con el NPC (no al entrar).
    this._minigameStarted = false

    // Valida la convención (áreas + estaciones) y reporta problemas por consola.
    this._validateMinigames()

    this._drawStationLabels()

    // ── NPCs (object layer "npcs") ───────────────────────────────
    this._buildNpcs(map)

    // ── Input ────────────────────────────────────────────────────
    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    })
    // Tecla E: si hay un NPC cerca → diálogo; si no, agarrar la cartulina.
    this._grabbing = false
    this.input.keyboard.on('keydown-E', () => {
      if (this.dialogOpen) { this._nextDialogPage(); return }
      // Hablar con el NPC solo antes de que empiece el minijuego.
      if (this._nearNpc && !this._minigameStarted) { this._talkToNpc(this._nearNpc); return }
      this._tryGrab()
    })
    // Espacio: confirma el Yes/No (si está abierto), o avanza/cierra el diálogo.
    this.input.keyboard.on('keydown-SPACE', () => {
      if (this._confirmOpen) {
        if (this._confirmSel != null) this._resolveConfirm(this._confirmSel === 0 ? 'yes' : 'no')
        return
      }
      this._nextDialogPage()
    })
    // Tecla Q: reproducir el audio de la palabra correcta (solo en el minijuego).
    this.input.keyboard.on('keydown-Q', () => this._playWord())
    // Resultado del recuadro Yes/No (clic desde React)
    this._onConfirmResult = (e) => this._resolveConfirm(e.detail?.id)
    window.addEventListener('confirm-result', this._onConfirmResult)
    this.events.once('shutdown', () => window.removeEventListener('confirm-result', this._onConfirmResult))

    // Teclado en el recuadro Yes/No: flechas/A/D cambian la selección, Enter confirma.
    const moveSel = (to) => {
      if (!this._confirmOpen) return
      this._confirmSel = to      // el teclado retoma el control
      playSfx('click')
      this._emitConfirm()
    }
    this.input.keyboard.on('keydown-LEFT',  () => moveSel(0))
    this.input.keyboard.on('keydown-A',     () => moveSel(0))
    this.input.keyboard.on('keydown-RIGHT', () => moveSel(1))
    this.input.keyboard.on('keydown-D',     () => moveSel(1))
    // Space confirma el Yes/No (solo si hay selección de teclado activa).
    // El mouse invalidó la selección de teclado → Enter no hace nada.
    this._onConfirmKbdOff = () => { if (this._confirmOpen) { this._confirmSel = null; this._emitConfirm() } }
    window.addEventListener('confirm-kbd-off', this._onConfirmKbdOff)
    this.events.once('shutdown', () => window.removeEventListener('confirm-kbd-off', this._onConfirmKbdOff))

    // ── HUD de diálogo (recuadro + rostro animado + texto paginado) ──
    this._buildDialogHud()
  }

  // Construye el recuadro de diálogo, en una cámara UI separada para que no lo
  // afecten el zoom ni el scroll del mundo (igual patrón que GameScene).
  _buildDialogHud() {
    const margin = 16
    this.dialogBox = this.add
      .image(this.scale.width / 2, this.scale.height - margin, 'dialog-box')
      .setOrigin(0.5, 1).setDepth(30)

    if (!this.anims.exists('face-doctor-talk')) {
      this.anims.create({
        key: 'face-doctor-talk',
        frames: this.anims.generateFrameNumbers('face-doctor', { start: 0, end: 9 }),
        frameRate: 8, repeat: -1,
      })
    }
    const boxTL = this.dialogBox.getTopLeft()
    this.dialogFace = this.add
      .sprite(boxTL.x + 32, boxTL.y + 32, 'face-doctor')
      .setOrigin(0, 0).setScale(2).setDepth(31).play('face-doctor-talk')

    const TX = 6 * 32, TY = 60
    const availWidth = this.dialogBox.width - TX - 48
    // dialogText de Phaser: SOLO como medidor para paginar (getWrappedText);
    // el texto visible se dibuja como overlay HTML (nítido). Queda invisible.
    this.dialogText = this.add
      .text(boxTL.x + TX, boxTL.y + TY, '', {
        fontFamily: 'Nunito', fontSize: '25px', color: '#2D2016',
        wordWrap: { width: availWidth }, maxLines: 2, lineSpacing: 12,
      })
      .setOrigin(0, 0).setDepth(31).setVisible(false)
    // Caja del texto del diálogo (para el overlay HTML), en pantalla.
    this._dialogTextBox = { x: boxTL.x + TX, y: boxTL.y + TY - 6, w: availWidth, h: 84 }

    this.dialogHint = this.add
      .text(boxTL.x + this.dialogBox.width - 20, boxTL.y + this.dialogBox.height - 14, '▶', {
        fontFamily: 'Nunito', fontSize: '26px', color: '#2D2016',
      })
      .setOrigin(1, 1).setDepth(31).setVisible(false)
    this.tweens.add({ targets: this.dialogHint, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 })

    // ── Contador de rondas (esquina superior derecha) ───────────
    // El recuadro mide 128×32; los 32px de cada lado son borde, el campo útil
    // son los 64 del medio. El texto va centrado ahí, con la fuente del diálogo.
    const RM = 12       // margen desde la esquina
    const RSCALE = 1.5  // escala del recuadro de rondas
    this.roundBox = this.add
      .image(this.scale.width - RM, RM, 'round-box')
      .setOrigin(1, 0).setScale(RSCALE).setDepth(30).setVisible(false)
    // El texto del contador va como overlay HTML; guardamos su caja (el campo
    // útil de los 64px del medio, escalado).
    this._roundNum = ''
    this._roundTextBox = () => {
      const tl = this.roundBox.getTopLeft()
      return { x: tl.x + 32 * RSCALE, y: tl.y, w: 64 * RSCALE, h: 32 * RSCALE }
    }

    // ── Indicación de audio "Press Q" (esquina superior izquierda) ──
    // Reutiliza el recuadro de diálogo escalado, con el rostro "main" animado.
    const QS = 0.6, QM = 12   // escala y margen (más grande, como el de rondas)
    this.qBox = this.add.image(QM, QM, 'dialog-box')
      .setOrigin(0, 0).setScale(QS).setDepth(30).setVisible(false)
    if (!this.anims.exists('face-main-talk')) {
      this.anims.create({
        key: 'face-main-talk',
        frames: this.anims.generateFrameNumbers('face-main', { start: 0, end: 9 }),
        frameRate: 8, repeat: -1,
      })
    }
    const qTL = this.qBox.getTopLeft()
    // El rostro va en (32,32) del recuadro original → escalado
    this.qFace = this.add.sprite(qTL.x + 32 * QS, qTL.y + 32 * QS, 'face-main')
      .setOrigin(0, 0).setScale(2 * QS).setDepth(31).play('face-main-talk').setVisible(false)
    // El TEXTO del recuadro Q se dibuja como overlay HTML (nítido) en React.
    // Guardamos su caja (a la derecha del rostro) para emitir la posición.
    const qTX = 6 * 32 * QS
    this._qTextBox = {
      x: qTL.x + qTX,
      y: this.qBox.y,
      w: this.qBox.displayWidth - qTX - 16,
      h: this.qBox.displayHeight,
    }

    // ── Recuadro de confirmación Yes/No (mismo tamaño que el diálogo) ──
    // Se dibuja el recuadro en Phaser; el texto y los botones (clickeables) van
    // como overlay HTML. Botones en (128,112) y (352,112), campo 96×32.
    this.confirmBox = this.add.image(this.scale.width / 2, this.scale.height - margin, 'confirm-box')
      .setOrigin(0.5, 1).setDepth(32).setVisible(false)

    // ── Corazones (fallos permitidos) — inferior izquierda, en horizontal ──
    const HMAX = 5   // máximo de corazones que puede haber (según dificultad)
    const HSC = 1.4, HGAP = 40 * 1.4
    this._heartMargin = 14
    this._hearts = []
    for (let i = 0; i < HMAX; i++) {
      const h = this.add.image(this._heartMargin + i * HGAP, this.scale.height - this._heartMargin, 'heart')
        .setOrigin(0, 1).setScale(HSC).setDepth(31).setVisible(false)
      this._hearts.push(h)
    }
    this._heartGap = HGAP

    // Cámara UI: sin zoom ni scroll, solo para el HUD.
    // La principal ignora el HUD; la UI ignora TODO lo demás (incluidos objetos
    // creados después, como las cartulinas que aparecen tras el diálogo).
    this.dialogHud = [this.dialogBox, this.dialogFace, this.dialogHint,
                      this.roundBox,
                      this.qBox, this.qFace,
                      this.confirmBox,
                      ...this._hearts]
    this._uiSet = new Set(this.dialogHud)
    this.uiCamera = this.cameras.add()
    this.cameras.main.ignore(this.dialogHud)
    this._syncUiCameraIgnore()

    // Reubicar el HUD al redimensionar (Scale.RESIZE)
    this.scale.on('resize', (gameSize) => {
      this.uiCamera.setSize(gameSize.width, gameSize.height)
      // Recuadro de diálogo (abajo-centro) + rostro + indicador ▶
      this.dialogBox.setPosition(gameSize.width / 2, gameSize.height - margin)
      const tl = this.dialogBox.getTopLeft()
      this.dialogFace.setPosition(tl.x + 32, tl.y + 32)
      this.dialogText.setPosition(tl.x + TX, tl.y + TY)   // medidor invisible
      this.dialogHint.setPosition(tl.x + this.dialogBox.width - 20, tl.y + this.dialogBox.height - 14)
      this._dialogTextBox = { x: tl.x + TX, y: tl.y + TY - 6, w: availWidth, h: 84 }
      // Contador de rondas (esquina superior derecha, X depende del ancho)
      this.roundBox.setPosition(gameSize.width - RM, RM)
      // Recuadro de confirmación (abajo-centro, como el diálogo)
      this.confirmBox.setPosition(gameSize.width / 2, gameSize.height - margin)
      // Corazones (abajo-izquierda)
      this._hearts.forEach((h, i) => h.setPosition(this._heartMargin + i * this._heartGap, gameSize.height - this._heartMargin))
      // Re-emitir los textos/overlays HTML con las nuevas posiciones
      this._emitHudText()
      if (this._confirmOpen) this._emitConfirm()
    })

    this.dialogOpen = false
    // El diálogo empieza oculto (el contador de rondas también, hasta jugar).
    for (const o of [this.dialogBox, this.dialogFace, this.dialogText, this.dialogHint]) {
      o.setVisible(false)
    }
  }

  // La cámara UI ignora todos los objetos del mundo (todo lo que no es HUD).
  // Se re-llama cuando aparecen objetos nuevos (ej. cartulinas tras el diálogo).
  _syncUiCameraIgnore() {
    if (!this.uiCamera) return
    const world = this.children.list.filter(o => !this._uiSet.has(o))
    this.uiCamera.ignore(world)
  }

  // Abre el diálogo del NPC. El NPC gira a mirar al jugador solo al hablar
  // (el resto del tiempo mira al frente); vuelve al frente al cerrar.
  _talkToNpc(npc) {
    const dx = this.player.x - npc._feetX
    const dy = this.player.y - (npc._feetY - 32)
    const dir = Math.abs(dx) > Math.abs(dy)
      ? (dx < 0 ? 'left' : 'right')
      : (dy < 0 ? 'up' : 'down')
    npc.play(`${npc._type}-${dir}`)
    this._talkingNpc = npc
    // Ocultar la tecla E de todos los NPCs al iniciar la conversación
    // (el update se detiene durante el diálogo, así que se oculta aquí).
    this._npcs?.forEach(n => n._keyE?.setVisible(false))

    // TEMP: frases de prueba (luego vendrán por NPC/minijuego).
    this._openDialog([
      'Hello! Can you help me?',
      'Listen to the word and pick the correct card.',
    ])
  }

  // Aviso al intentar salir de la zona con el minijuego en curso. Detiene al
  // jugador y muestra el recuadro de diálogo con el rostro "main".
  // (El Yes/No se agregará después; por ahora solo el aviso.)
  _promptExit() {
    if (this.dialogOpen || this._exiting) return
    this._exiting = true
    // Empujar levemente al jugador de vuelta hacia dentro del área para que no
    // quede "pegado" al borde al reanudar.
    const a = this._activeArea
    this.player.x = Phaser.Math.Clamp(this.player.x, a.x + 6, a.x + a.w - 6)
    this.player.y = Phaser.Math.Clamp(this.player.y, a.y + 6, a.y + a.h - 6)
    this._openDialog(
      [
        'Wait! Do you want to leave the game?',
        'If you leave now, your progress will be lost.',
      ],
      () => this._openConfirm(),   // al terminar el aviso → recuadro Yes/No
      'main',
    )
  }

  // Muestra el recuadro Yes/No y emite su texto + botones (clickeables) a React.
  _openConfirm() {
    this._confirmOpen = true
    this._confirmSel = 1   // 0=Yes, 1=No → predeterminado en "No"
    this.confirmBox.setVisible(true)
    this._syncUiCameraIgnore()
    this._emitConfirm()
  }

  // Emite a React el texto de confirmación + las cajas de los botones Yes/No,
  // en coordenadas de PANTALLA (el HUD no tiene zoom/scroll).
  _emitConfirm() {
    const tl = this.confirmBox.getTopLeft()
    const pad = 1   // margen mínimo: la zona hover/clic cubre casi todo el botón
    window.dispatchEvent(new CustomEvent('confirm-box', {
      detail: {
        prompt: { text: 'Leave the game?', x: tl.x + 32, y: tl.y + 36, w: 512, h: 56 },
        selected: this._confirmSel,   // botón resaltado por teclado (0=Yes, 1=No)
        buttons: [
          { id: 'yes', text: 'Yes', x: tl.x + 128 + pad, y: tl.y + 112 + pad, w: 96 - pad * 2, h: 32 - pad * 2 },
          { id: 'no',  text: 'No',  x: tl.x + 352 + pad, y: tl.y + 112 + pad, w: 96 - pad * 2, h: 32 - pad * 2 },
        ],
      },
    }))
  }

  // Resultado del clic en Yes/No (viene de React).
  _resolveConfirm(id) {
    this._confirmOpen = false
    this.confirmBox.setVisible(false)
    window.dispatchEvent(new CustomEvent('confirm-box', { detail: null }))   // ocultar overlay
    if (id === 'yes') {
      // Salir: termina el minijuego y reanuda el movimiento.
      this._endMinigame()
      this._exiting = false
    } else {
      // No: sigue jugando (reanuda dentro de la zona).
      this._exiting = false
    }
  }

  _openDialog(text, onComplete = null, face = 'doctor') {
    this.dialogOpen = true
    this._dialogOnComplete = onComplete
    this.player?.setVelocity(0)
    // Rostro del recuadro: 'doctor' (NPC) o 'main' (jugador, ej. aviso de salir)
    this.dialogFace.setTexture(`face-${face}`).play(`face-${face}-talk`)
    // Mostrar solo los elementos del recuadro de diálogo (no el HUD del minijuego)
    this.dialogBox.setVisible(true)
    this.dialogFace.setVisible(true)
    this.dialogHint.setVisible(false)
    this._setDialogText(text)
  }

  _closeDialog() {
    this.dialogOpen = false
    // Ocultar solo los elementos del recuadro de diálogo
    this.dialogBox.setVisible(false)
    this.dialogFace.setVisible(false)
    this.dialogHint.setVisible(false)
    this._dialogText = null
    this._emitHudText()   // refresca los textos HTML (quita el del diálogo)
    // El NPC vuelve a mirar al frente
    if (this._talkingNpc) {
      this._talkingNpc.play(`${this._talkingNpc._type}-down`)
      this._talkingNpc = null
    }
    const cb = this._dialogOnComplete
    this._dialogOnComplete = null
    if (cb) cb()

    // Al terminar el diálogo del NPC, arranca el minijuego (aparecen las cartulinas).
    if (!this._minigameStarted) this._startMinigame()
  }

  // Reproduce el audio de la palabra correcta (tecla Q). La nota sobre el NPC se
  // muestra solo mientras dura el audio (+0.5s) y luego desaparece.
  _playWord() {
    if (!this._minigameStarted || this._wordPlaying) return
    const word = this._correctWord || 'Headache'   // TEMP de prueba
    const base = unit4.paths?.audioChoose || '/assets/content/grade4/unit4/audio/ListeningChoose/'
    const audio = new Audio(base + word + '.mp3')

    // Mostrar la nota (reproduce sus frames y queda en el último)
    this._wordPlaying = true
    this._npcs?.forEach(n => { n._note?.setVisible(true); n._note?.play('note-play') })

    const hideNote = () => {
      this._wordPlaying = false
      this._npcs?.forEach(n => n._note?.setVisible(false))
    }
    // Ocultar 0.1s después de que termine el audio (con fallback por si falla)
    audio.addEventListener('ended', () => this.time.delayedCall(100, hideNote))
    audio.addEventListener('error', hideNote)
    audio.play().catch(hideNote)
  }

  // Muestra las cartulinas y activa su colisión (al terminar el diálogo).
  _startMinigame() {
    this._minigameStarted = true
    this._stationCards.forEach(c => c.setVisible(true))
    this._stationBodies.forEach(b => { b.isSensor = false })
    // La nota NO se muestra al empezar; aparece solo mientras suena el audio (Q).
    this.roundBox.setVisible(true)
    this.qBox.setVisible(true)
    this.qFace.setVisible(true)
    // Oscurecido fuera de la zona de juego (solo si el área lo pide con
    // la propiedad `darken` en Tiled; útil en espacios abiertos).
    if (this._activeArea?.darken) {
      this._drawDarkOverlay()
      this._darkOverlay.setVisible(true)
    }
    // Corazones (fallos permitidos) según la dificultad.
    this._heartsMax = HEARTS_BY_DIFFICULTY[DIFFICULTY] ?? 2
    this._heartsLeft = this._heartsMax
    this._updateHearts()

    // El texto (Q + rondas) se emite como overlay HTML en _applyRound.
    this._syncUiCameraIgnore()   // que la cámara UI no duplique las cartulinas

    // Generar las rondas y arrancar la primera. (TEMP: 2 rondas para probar)
    this._rounds = this._genRounds(2)
    this._roundIdx = 0
    this._applyRound()
  }

  // Muestra los corazones restantes (los sobrantes ocultos).
  _updateHearts() {
    this._hearts?.forEach((h, i) => h.setVisible(i < this._heartsLeft))
  }

  // Quita un corazón (al fallar). Si llegan a 0, el minijuego termina (derrota);
  // vuelve al estado inicial y queda disponible para reintentar hablando al NPC.
  _loseHeart() {
    if (this._heartsLeft <= 0) return
    this._heartsLeft--
    this._updateHearts()
    if (this._heartsLeft <= 0) {
      this.time.delayedCall(600, () => this._endMinigame())
    }
  }

  // Genera N rondas (mismo criterio que el minijuego de UI): las N palabras
  // CORRECTAS son distintas entre sí (una por ronda, sin repetir). Las 3
  // distractoras de cada ronda se eligen al azar (pueden repetirse entre rondas,
  // pero nunca dentro de la misma ronda).
  _genRounds(n) {
    const shuffle = arr => [...arr].sort(() => Math.random() - 0.5)
    const vocab = unit4.vocabulary
    const nStations = this._stations.length   // 4
    const corrects = shuffle(vocab).slice(0, Math.min(n, vocab.length))
    const rounds = []
    for (let r = 0; r < corrects.length; r++) {
      const correct = corrects[r]
      const distractors = shuffle(vocab.filter(v => v.id !== correct.id)).slice(0, nStations - 1)
      const words = shuffle([correct, ...distractors])   // orden en las mesas
      const correctSlot = words.findIndex(v => v.id === correct.id)
      rounds.push({
        words: words.map(v => v.word),
        correctSlot,
        correctWord: correct.word,
      })
    }
    return rounds
  }

  // Aplica la ronda actual: pone las palabras en las mesas, define la correcta
  // y reproduce su audio.
  _applyRound() {
    const round = this._rounds[this._roundIdx]
    this._stationWords = round.words.slice()
    this._correctWord = round.correctWord
    this._correctSlot = round.correctSlot
    // Los corazones se recuperan al inicio de cada ronda (fallos permitidos por ronda).
    this._heartsLeft = this._heartsMax
    this._updateHearts()
    // Contador de rondas (1-based) → overlay HTML
    this._roundNum = `${this._roundIdx + 1}/${this._rounds.length}`
    this._emitHudText()
    // Reproduce el audio de la palabra al empezar la ronda (pequeño retardo para
    // que no se solape con el sonido de acierto de la ronda anterior).
    this.time.delayedCall(350, () => this._playWord())
  }

  // Avanza a la siguiente ronda; si se completaron todas, VICTORIA (celebración).
  _nextRound() {
    this._roundIdx++
    if (this._roundIdx >= this._rounds.length) {
      this._winMinigame()
    } else {
      this._applyRound()
    }
  }

  // Victoria: confetti (mismo efecto que los minijuegos de prueba, vía React) +
  // sonido, y luego termina el minijuego.
  _winMinigame() {
    // React dispara el confetti (canvas-confetti) + victory al recibir el evento.
    window.dispatchEvent(new CustomEvent('minigame-celebrate'))
    this.time.delayedCall(3000, () => this._endMinigame())
  }

  // Termina el minijuego y vuelve TODO al estado inicial (jugable otra vez).
  _endMinigame() {
    this._minigameStarted = false
    this._stationCards.forEach(c => c.setVisible(false))
    this._stationBodies.forEach(b => { b.isSensor = true })
    this._stationKeys.forEach(k => k.setVisible(false))
    this._stationHighlights.forEach(h => h.setVisible(false))
    this._npcs?.forEach(n => n._note?.setVisible(false))
    this._clearStationLabels()
    this.roundBox?.setVisible(false)
    this.qBox?.setVisible(false)
    this.qFace?.setVisible(false)
    this._hearts?.forEach(h => h.setVisible(false))   // ocultar corazones
    this._darkOverlay?.setVisible(false)   // quitar el oscurecido
    this._clearHudText()         // ocultar todos los textos HTML del HUD
    this._correctWord = null
    this._correctSlot = null
  }

  _setDialogText(text) {
    const messages = Array.isArray(text) ? text : [text]
    this._dialogPages = []
    for (const msg of messages) {
      const lines = this.dialogText.getWrappedText(msg)
      for (let i = 0; i < lines.length; i += 2) {
        this._dialogPages.push(lines.slice(i, i + 2).join('\n'))
      }
    }
    if (this._dialogPages.length === 0) this._dialogPages = ['']
    this._dialogPage = 0
    this._showDialogPage()
  }

  _showDialogPage() {
    this._dialogText = this._dialogPages[this._dialogPage]   // → overlay HTML
    this._emitHudText()
    this.dialogHint.setVisible(this._dialogPage < this._dialogPages.length - 1)
  }

  _nextDialogPage() {
    if (!this.dialogOpen) return
    if (this._dialogPage < this._dialogPages.length - 1) {
      this._dialogPage++
      this._showDialogPage()
    } else {
      this._closeDialog()
    }
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
          darken: prop('darken') === true,   // oscurecer fuera de la zona (opcional)
        }
      })
      .filter(Boolean)
  }

  // Dibuja el oscurecido cubriendo todo el mundo MENOS el rectángulo del área
  // activa (4 franjas alrededor del hueco). Se llama al empezar el minijuego.
  _drawDarkOverlay() {
    const g = this._darkOverlay
    g.clear()
    const a = this._activeArea
    if (!a) return
    const W = this._mapW, H = this._mapH
    const alpha = 0.45
    g.fillStyle(0x000000, alpha)
    // Franja superior, inferior, izquierda y derecha del hueco del área
    g.fillRect(0, 0, W, a.y)                                  // arriba
    g.fillRect(0, a.y + a.h, W, H - (a.y + a.h))              // abajo
    g.fillRect(0, a.y, a.x, a.h)                              // izquierda
    g.fillRect(a.x + a.w, a.y, W - (a.x + a.w), a.h)          // derecha
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

  // Lee la object layer "npcs" y dibuja cada NPC anclado por los pies. Idle
  // frontal por defecto; mira al jugador según su dirección al acercarse.
  _buildNpcs(map) {
    this._npcs = []
    const layer = map.getObjectLayer('npcs')
    if (!layer) return
    // Asegura la animación de la tecla E (por si no hay stations que la creen).
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
    for (const o of layer.objects) {
      const prop = n => (o.properties ?? []).find(p => p.name === n)?.value
      const type = prop('npc') || 'doctor'
      const key = `npc-${type}`
      if (!this.textures.exists(key)) continue

      // Posición de los pies: punto → (x,y); rectángulo → centro-inferior.
      const feetX = o.point ? o.x : o.x + (o.width || 0) / 2
      const feetY = o.point ? o.y : o.y + (o.height || 0)
      // El sprite mide 32×64; origen (0.5,1) lo ancla por los pies.
      const spr = this.add.sprite(feetX, feetY, key, 18).setOrigin(0.5, 1)
      spr.setDepth(this.YSORT_BASE + feetY)   // Y-sort por sus pies
      spr.play(`${type}-down`)                // idle frontal por defecto
      spr._type = type
      spr._feetX = feetX
      spr._feetY = feetY
      spr._facing = 'down'
      // Colisión estática (que el jugador no lo atraviese): caja en los pies.
      this.matter.add.rectangle(feetX, feetY - 16, 24, 24, { isStatic: true })

      // Tecla E flotando sobre la cabeza del NPC (oculta hasta acercarse).
      const keyDepth = this.YSORT_BASE + this.map.heightInPixels + 400
      spr._keyE = this.add.sprite(feetX, feetY - 64 - 14, 'key-e')
        .setDepth(keyDepth)
        .play('key-e-pulse')
        .setVisible(false)

      // Ícono de nota (2 frames en bucle) sobre la cabeza; aparece tras hablar.
      if (this.textures.exists('note')) {
        if (!this.anims.exists('note-play')) {
          this.anims.create({
            key: 'note-play',
            frames: this.anims.generateFrameNumbers('note', { start: 0, end: 5 }),
            frameRate: 10, repeat: 0,   // una sola pasada; queda en el frame 6
          })
        }
        spr._note = this.add.sprite(feetX, feetY - 64 - 16, 'note', 5)   // frame final por defecto
          .setDepth(keyDepth)
          .setVisible(false)
      }

      this._npcs.push(spr)
    }
  }

  // El NPC siempre mira al frente; muestra la tecla E cuando el jugador está en
  // rango (para interactuar). El giro hacia el jugador ocurre solo al hablar (E).
  _updateNpcs() {
    if (!this._npcs?.length) return
    const NEAR = 90   // radio en el que aparece la tecla E
    const px = this.player.x, py = this.player.y
    this._nearNpc = null
    for (const npc of this._npcs) {
      const dist = Math.hypot(px - npc._feetX, py - (npc._feetY - 32))
      const near = dist <= NEAR
      if (near) this._nearNpc = npc
      // La tecla E del NPC solo antes de empezar el minijuego (para hablarle).
      npc._keyE.setVisible(near && !this._grabbing && !this.dialogOpen && !this._minigameStarted)
    }
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
    this._stationBodies = []   // cuerpos de colisión de las cartulinas
    this._stations.forEach((s) => {
      // Cartulina oculta hasta que empiece el minijuego (tras hablar con el NPC)
      const card = this.add.image(s.cx, s.cy, 'mg-card').setVisible(false)
      this._stationCards.push(card)
      // Y-sort por la base de la cartulina (su borde inferior).
      const baseY = s.cy + CARD_H / 2
      card.setDepth(this.YSORT_BASE + baseY)
      // Colisión del tamaño de la cartulina (inactiva hasta que aparezca).
      const body = this.matter.add.rectangle(s.cx, s.cy, CARD_W, CARD_H, { isStatic: true })
      body.isSensor = true
      this._stationBodies.push(body)

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
    if (!this._stations?.length || !this._minigameStarted) return
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

  // Emite a React el texto del recuadro Q como overlay HTML (nítido, Nunito).
  // La caja está en coordenadas de PANTALLA (el HUD no tiene zoom/scroll).
  // Emite TODOS los textos de HUD activos como overlay HTML (nítido). Cada uno
  // lleva su caja de pantalla, texto, tamaño y alineación.
  _emitHudText() {
    const texts = []
    // Indicación Q + contador de rondas: mientras el minijuego está en curso.
    if (this._minigameStarted) {
      const q = this._qTextBox
      if (q) texts.push({ id: 'q', text: '🔊 Press Q to listen again',
        x: q.x, y: q.y, w: q.w, h: q.h, size: 18, align: 'left' })
      const r = this._roundTextBox?.()
      if (r) texts.push({ id: 'round', text: this._roundNum,
        x: r.x, y: r.y, w: r.w, h: r.h, size: 22, align: 'center' })
    }
    // Texto del diálogo del NPC: mientras está abierto.
    if (this.dialogOpen && this._dialogText != null) {
      const d = this._dialogTextBox
      if (d) texts.push({ id: 'dialog', text: this._dialogText,
        x: d.x, y: d.y, w: d.w, h: d.h, size: 25, align: 'left', lineHeight: 1.55 })
    }
    window.dispatchEvent(new CustomEvent('hud-texts', { detail: { texts } }))
  }

  _clearHudText() {
    window.dispatchEvent(new CustomEvent('hud-texts', { detail: { texts: [] } }))
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

    // Durante el diálogo: jugador inmóvil en idle; el HUD manda.
    if (this.dialogOpen || this._confirmOpen) {
      player.setVelocity(0)
      player.play('idle-' + this.lastDir, true)
      this._updateCamera()
      if (this._activeArea) this._emitStationLabels()
      return
    }

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

    // Si el minijuego está en curso y el jugador toca el borde de la zona,
    // detenerlo y mostrar el aviso de salir.
    if (this._minigameStarted && this._activeArea) {
      const a = this._activeArea
      const px = player.x, py = player.y
      if (px < a.x || px > a.x + a.w || py < a.y || py > a.y + a.h) {
        player.setVelocity(0)
        this._promptExit()
        return
      }
    }

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

    // NPCs: miran al jugador cuando está cerca.
    this._updateNpcs()

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

    // ¿Es la correcta? (según la ronda actual)
    const correct = idx === this._correctSlot

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
    this._syncUiCameraIgnore()   // que la cámara UI no duplique la carta/feedback

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

    // Al terminar de bajar: volver al idle, desbloquear y avanzar de ronda.
    player.once('animationcomplete-grab-down', () => {
      this._grabbingIdx = null
      this.lastDir = prevDir
      player.setTexture(CHAR_IDLE, 0)
      player.play('idle-' + prevDir)
      this._grabbing = false
      // Acierto → siguiente ronda (nuevas palabras) o fin del minijuego.
      this._nextRound()
      // Si el minijuego sigue, la cartulina reaparece con la nueva palabra.
      if (this._minigameStarted) this._stationCards[idx].setVisible(true)
    })
  }

  // Respuesta INCORRECTA: la cartulina se queda en la mesa, se tiñe de rojo
  // pastel y se sacude (como el feedback de error de los minijuegos de UI).
  _rejectStation(idx) {
    if (this._rejecting?.[idx]) return
    this._rejecting = this._rejecting || {}
    this._rejecting[idx] = true

    // Fallo → pierde un corazón (y quizás reinicia).
    this._loseHeart()

    const s = this._stations[idx]
    const card = this._stationCards[idx]
    const cardDepth = this.YSORT_BASE + this.map.heightInPixels + 500

    // Overlay rojo pastel sobre la cartulina.
    const flash = this.add.rectangle(s.cx, s.cy, 96, 64, 0xf5c2bb, 0.55)
      .setStrokeStyle(3, 0xe89a90, 1)
      .setDepth(cardDepth)
    this._syncUiCameraIgnore()   // que la cámara UI no duplique el flash

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
    if (!this._stationKeys?.length || !this._minigameStarted) return
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
