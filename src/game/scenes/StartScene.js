import * as Phaser from 'phaser'

export class StartScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StartScene' })
  }

  preload() {
    // Fondo estático — el mismo PNG que ya tenías funcionando
    this.load.image('start-bg', '/assets/backgrounds/start-bg.png')

    // Spritesheets animados
    this.load.spritesheet('torch', '/assets/spritesheets/torch.png', {
      frameWidth: 32,
      frameHeight: 32
    })
    this.load.spritesheet('cooking-area', '/assets/spritesheets/cooking-area.png', {
      frameWidth: 64,
      frameHeight: 64
    })
    this.load.audio('menu-music', [
      '/assets/sounds/menu-music.ogg',
      '/assets/sounds/menu-music.mp3'
    ])
  }

  create() {
    // ── Fondo estático ─────────────────────────────────────
    const bg = this.add.image(
      this.scale.width  / 2 + 100,
      this.scale.height / 2,
      'start-bg'
    )
    // Escalar para que el ALTO llene la pantalla exacto
    // y el ancho se recorte simétricamente a los lados
    const scale = this.scale.height / bg.height
    bg.setScale(scale)

    // ── Animaciones ────────────────────────────────────────
    this.anims.create({
      key: 'torch-burn',
      frames: this.anims.generateFrameNumbers('torch', { start: 0, end: 5 }),
      frameRate: 10,
      repeat: -1
    })

    this.anims.create({
      key: 'cooking-fire',
      frames: this.anims.generateFrameNumbers('cooking-area', { start: 0, end: 11 }),
      frameRate: 12,
      repeat: -1
    })

    // ── Sprites animados ───────────────────────────────────
    const { width, height } = this.scale
    this.add.sprite(width * 0.12, height * 0.637, 'torch').setScale(2).play('torch-burn')
    this.add.sprite(width * 0.70, height * 0.637, 'torch').setScale(2).play('torch-burn')
    this.add.sprite(width * 0.35, height * 0.593, 'cooking-area').setScale(2).play('cooking-fire')

    // Reproducir la música
    const music = this.sound.add('menu-music', {
      volume: 0.2,   // volumen entre 0 y 1
      loop: true     // loop infinito
    })
    music.play()
  }
}