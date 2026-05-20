import * as Phaser from 'phaser'

export class ListenChooseScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ListenChooseScene' })
    this.currentPlatform = 0
    this.totalPlatforms  = 4
  }

  preload() {
    // Placeholder — después reemplazás con tu spritesheet real
    const graphics = this.make.graphics({ x: 0, y: 0, add: false })
    graphics.fillStyle(0xd97706)
    graphics.fillRect(0, 0, 32, 32)
    graphics.generateTexture('player-placeholder', 32, 32)
    graphics.destroy()
  }

  create() {
    const W = this.scale.width   // 1280
    const H = this.scale.height  // 380 (el área de Phaser no es la pantalla completa)

    // ── Fondo ──────────────────────────────────────────────
    this.add.rectangle(W / 2, H / 2, W, H, 0x1a2a1a)

    // Árboles decorativos simples
    this.add.rectangle(60,  H - 40, 20, 80, 0x0f2010)
    this.add.rectangle(100, H - 50, 20, 100, 0x0f2010)
    this.add.rectangle(W - 60,  H - 40, 20, 80,  0x0f2010)
    this.add.rectangle(W - 100, H - 50, 20, 100, 0x0f2010)

    // ── Plataformas en escalera ────────────────────────────
    const platformData = [
      { x: 180,  y: H - 60,  label: 'Start' },
      { x: 420,  y: H - 120, label: ''      },
      { x: 660,  y: H - 180, label: ''      },
      { x: 900,  y: H - 240, label: '🏆'   },
    ]

    this.platformGroup = this.physics.add.staticGroup()
    this.platformPositions = []

    platformData.forEach(({ x, y, label }) => {
      // Plataforma visual
      const plat = this.add.rectangle(x, y, 140, 20, 0x5c3d1e)
      plat.setStrokeStyle(2, 0x8b5e3c)

      // Física estática
      const body = this.physics.add.existing(
        this.add.rectangle(x, y, 140, 20, 0x000000, 0),
        true
      )
      this.platformGroup.add(body)

      // Label encima de la plataforma
      if (label) {
        this.add.text(x, y - 20, label, {
          fontSize: '11px',
          color: '#fde68a',
          fontFamily: 'Arial'
        }).setOrigin(0.5)
      }

      // Guardar posición donde va a pararse el personaje
      this.platformPositions.push({ x, y: y - 36 })
    })

    // ── Personaje ──────────────────────────────────────────
    this.player = this.physics.add.sprite(
      this.platformPositions[0].x,
      this.platformPositions[0].y,
      'player-placeholder'
    )
    this.player.setCollideWorldBounds(true)
    this.player.body.allowGravity = false // el movimiento lo manejamos con tweens

    // ── Escuchar respuestas de React ───────────────────────
    this.onAnswer = this.handleAnswer.bind(this)
    window.addEventListener('answer-result', this.onAnswer)
  }

  handleAnswer(event) {
    const { correct } = event.detail

    if (correct && this.currentPlatform < this.totalPlatforms - 1) {
      this.currentPlatform++
    } else if (!correct && this.currentPlatform > 0) {
      this.currentPlatform--
    }

    this.movePlayerToPlatform()

    // Si llegó a la cima
    if (this.currentPlatform === this.totalPlatforms - 1) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('minigame-complete'))
      }, 800)
    }
  }

  movePlayerToPlatform() {
    const target = this.platformPositions[this.currentPlatform]

    this.tweens.add({
      targets: this.player,
      x: target.x,
      y: target.y - 20, // arco de salto
      duration: 250,
      ease: 'Power2',
      yoyo: false,
      onComplete: () => {
        this.tweens.add({
          targets: this.player,
          y: target.y,
          duration: 150,
          ease: 'Bounce.Out'
        })
      }
    })
  }

  shutdown() {
    window.removeEventListener('answer-result', this.onAnswer)
  }
}