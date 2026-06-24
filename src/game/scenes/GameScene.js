import * as Phaser from 'phaser'

const WORLD_W = 1280
const WORLD_H = 5400

const JUMP_MIN     = -490   // salto mínimo (toque rápido)
const JUMP_MAX     = -1000  // salto máximo (carga completa)
const CHARGE_TIME  = 500   // ms para llegar a carga completa
const MOVE_SPEED   = 320

// [centerX, centerY, width] — zigzag going upward
const PLATFORMS = [
  [640,  5370, 1280], // suelo
  [250,  5100,  280],
  [900,  4830,  260],
  [550,  4580,  280],
  [950,  4330,  240],
  [320,  4090,  280],
  [750,  3850,  260],
  [180,  3610,  240],
  [680,  3370,  280],
  [1000, 3130,  240],
  [380,  2890,  260],
  [800,  2660,  240],
  [200,  2430,  260],
  [620,  2200,  280],
  [950,  1970,  240],
  [340,  1740,  260],
  [720,  1510,  260],
  [480,  1280,  280],
  [880,  1050,  240],
  [300,   820,  260],
  [640,   500,  400], // cima
]

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene')
  }

  create() {
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H)
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H)
    this.cameras.main.setBackgroundColor('#A8D8F0')

    this._buildTextures()
    this._createPlatforms()
    this._createPlayer()
    this._createInput()

    this.cameras.main.startFollow(this.player, true, 1, 0.1)

    // Estado del salto con carga
    this.jumpCharge  = 0
    this.isCharging  = false
  }

  _buildTextures() {
    const pg = this.add.graphics()
    pg.fillStyle(0x4CAB4D)
    pg.fillRect(0, 0, 32, 48)
    pg.fillStyle(0x2D8B2D)
    pg.fillRect(6, 2, 20, 18)
    pg.generateTexture('player', 32, 48)
    pg.destroy()

    const widths = [...new Set(PLATFORMS.map(p => p[2]))]
    widths.forEach(w => {
      if (this.textures.exists(`plat_${w}`)) return
      const g = this.add.graphics()
      g.fillStyle(0x5D8A4E)
      g.fillRect(0, 0, w, 20)
      g.fillStyle(0x7BC67E)
      g.fillRect(0, 0, w, 6)
      g.generateTexture(`plat_${w}`, w, 20)
      g.destroy()
    })
  }

  _createPlatforms() {
    this.platforms = this.physics.add.staticGroup()
    PLATFORMS.forEach(([x, y, w]) => {
      const p = this.platforms.create(x, y, `plat_${w}`)
      p.setImmovable(true)
      p.refreshBody()
    })
  }

  _createPlayer() {
    this.player = this.physics.add.sprite(WORLD_W / 2, 5300, 'player')
    this.player.setCollideWorldBounds(true)
    this.physics.add.collider(this.player, this.platforms)
  }

  _createInput() {
    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    })
  }

  update(time, delta) {
    const { player, cursors, wasd } = this
    const onGround = player.body.blocked.down

    // ── Movimiento horizontal (bloqueado mientras carga) ────────
    const goLeft  = cursors.left.isDown  || wasd.left.isDown
    const goRight = cursors.right.isDown || wasd.right.isDown

    if (!this.isCharging) {
      if (goLeft)       player.setVelocityX(-MOVE_SPEED)
      else if (goRight) player.setVelocityX(MOVE_SPEED)
      else              player.setVelocityX(0)
    } else {
      player.setVelocityX(0)
    }

    if (goLeft)       player.setFlipX(true)
    else if (goRight) player.setFlipX(false)

    // ── Lógica del salto con carga ───────────────────────────────
    const jumpJustDown =
      Phaser.Input.Keyboard.JustDown(cursors.up)    ||
      Phaser.Input.Keyboard.JustDown(cursors.space)  ||
      Phaser.Input.Keyboard.JustDown(wasd.up)

    const jumpHeld =
      cursors.up.isDown    ||
      cursors.space.isDown ||
      wasd.up.isDown

    const jumpJustUp =
      Phaser.Input.Keyboard.JustUp(cursors.up)    ||
      Phaser.Input.Keyboard.JustUp(cursors.space)  ||
      Phaser.Input.Keyboard.JustUp(wasd.up)

    // Iniciar carga
    if (jumpJustDown && onGround) {
      this.isCharging = true
      this.jumpCharge = 0
    }

    // Aumentar carga mientras se mantiene en el suelo
    if (this.isCharging && onGround && jumpHeld) {
      this.jumpCharge = Math.min(1, this.jumpCharge + delta / CHARGE_TIME)

      // Squish visual: se aplana mientras carga
      const scaleX = 1 + this.jumpCharge * 0.18
      const scaleY = 1 - this.jumpCharge * 0.22
      player.setScale(scaleX, scaleY)
    }

    // Soltar → ejecutar salto
    if (this.isCharging && jumpJustUp) {
      if (onGround) {
        const velocity = JUMP_MIN + (JUMP_MAX - JUMP_MIN) * this.jumpCharge
        player.setVelocityY(velocity)
      }
      this._resetCharge()
    }

    // Cancelar si salió del suelo sin soltar (p.ej. cayó del borde)
    if (this.isCharging && !onGround) {
      this._resetCharge()
    }

    // ── Zona de muerte ───────────────────────────────────────────
    if (player.y > WORLD_H + 60) {
      player.setPosition(WORLD_W / 2, 5300)
      player.setVelocity(0, 0)
      this._resetCharge()
    }
  }

  _resetCharge() {
    this.isCharging = false
    this.jumpCharge = 0
    this.player.setScale(1, 1)
  }
}
