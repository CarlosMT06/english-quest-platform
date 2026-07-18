import * as Phaser from 'phaser'

// Variantes de autos con el mismo layout (3840×320, frames 160×160, 24×2;
// direcciones en la fila 2: derecha 24-29, izquierda 36-41)
const CAR_VARIANTS = [
  'Car_4_32x32_1', 'Car_4_32x32_2', 'Car_4_32x32_3', 'Car_4_32x32_4',
  'Car_4_32x32_5', 'Car_4_32x32_6', 'Car_4_32x32_7',
  'Car_5_32x32_1', 'Car_5_32x32_2', 'Car_5_32x32_3',
  'Car_5_32x32_4', 'Car_5_32x32_5', 'Car_5_32x32_6',
]

// Personajes del fondo (frames de 32×64). start/end = rango de frames a animar.
const CHARACTERS = [
  { key: 'character1', file: 'Character1.png', start: 0,  end: 5,  tileX: 14.25, tileY: 21.2 },
  { key: 'character2', file: 'Character2.png', start: 18, end: 23, tileX: 3.5, tileY: 17.5 },
  { key: 'character3', file: 'Character3.png', start: 18, end: 23, tileX: 21.4,  tileY: 13.5   },
  { key: 'character4', file: 'Character4.png', start: 18, end: 23, tileX: 13.5,  tileY: 12.8   },
  { key: 'character5', file: 'Character5.png', start: 18, end: 23, tileX: 5,  tileY: 17.5   },
  { key: 'character6', file: 'Character6.png', start: 18, end: 23, tileX: 23,  tileY: 13.5   },
  { key: 'character7', file: 'Character7.png', start: 0,  end: 5,  tileX: 13,  tileY: 21.5     },
]

export class StartScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StartScene' })
  }

  preload() {
    // Fondo estático
    this.load.image('start-bg', '/assets/backgrounds/start-bg.png')

    // Puerta animada (14 frames de 96×96 → 1344×96)
    this.load.spritesheet('metropolis-door', '/assets/spritesheets/Metropolis_Building_1_Door_1_32x32.png', {
      frameWidth: 96,
      frameHeight: 96,
    })

    // Vehículos (variados; frames de 160×160)
    CAR_VARIANTS.forEach(key => {
      this.load.spritesheet(key, `/assets/spritesheets/Vehicles/${key}.png`, {
        frameWidth: 160,
        frameHeight: 160,
      })
    })

    // Camión de basura (solo hacia la izquierda; 6 frames de 256×160)
    this.load.spritesheet('trash-truck', '/assets/spritesheets/Vehicles/Trash_Truck_Going_Left_32x32.png', {
      frameWidth: 256,
      frameHeight: 160,
    })

    // Personajes (frames de 32×64)
    CHARACTERS.forEach(c => {
      this.load.spritesheet(c.key, `/assets/spritesheets/${c.file}`, {
        frameWidth: 32,
        frameHeight: 64,
      })
    })


    this.load.audio('menu-music', [
      '/assets/sounds/menu-music.ogg',
      '/assets/sounds/menu-music.mp3'
    ])
  }

  create() {
    // ── Fondo estático ─────────────────────────────────────
    const bg = this.add.image(
      this.scale.width  / 2,
      this.scale.height / 2,
      'start-bg'
    )
    // Escalar para que el ALTO llene la pantalla exacto
    // y el ancho se recorte simétricamente a los lados
    const scale = this.scale.height / bg.height
    bg.setScale(scale)

    // ── Puerta animada (tile 74×33 del fondo, tiles de 32px) ───
    this.anims.create({
      key: 'metropolis-door-anim',
      frames: this.anims.generateFrameNumbers('metropolis-door', { start: 0, end: 13 }),
      frameRate: 8,
      repeat: -1,
    })

    const TILE = 32
    // Esquina sup-izq del fondo en pantalla (para ubicar por tile)
    const bgLeft = bg.x - bg.displayWidth  / 2
    const bgTop  = bg.y - bg.displayHeight / 2
    this.add
      .sprite(bgLeft + 73 * TILE * scale, bgTop + 30 * TILE * scale, 'metropolis-door')
      .setOrigin(0, 0)
      .setScale(scale)   // misma escala que el fondo
      .play('metropolis-door-anim')

    // ── Personajes del fondo ─────────────────────────────────────
    CHARACTERS.forEach(c => {
      this.anims.create({
        key: `${c.key}-anim`,
        frames: this.anims.generateFrameNumbers(c.key, { start: c.start, end: c.end }),
        frameRate: 8,
        repeat: -1,
      })
      this.add
        .sprite(bgLeft + c.tileX * TILE * scale, bgTop + c.tileY * TILE * scale, c.key)
        .setOrigin(0, 0)
        .setScale(scale)
        .play(`${c.key}-anim`)
    })

    // ── Vehículos que cruzan la calle ─────────────────────────
    // Por cada variante, animación hacia derecha (24-29) e izquierda (36-41)
    CAR_VARIANTS.forEach(key => {
      this.anims.create({
        key: `${key}-right`,
        frames: this.anims.generateFrameNumbers(key, { start: 24, end: 29 }),
        frameRate: 12,
        repeat: -1,
      })
      this.anims.create({
        key: `${key}-left`,
        frames: this.anims.generateFrameNumbers(key, { start: 36, end: 41 }),
        frameRate: 12,
        repeat: -1,
      })
    })

    // Camión de basura: solo hacia la izquierda
    this.anims.create({
      key: 'trash-truck-left',
      frames: this.anims.generateFrameNumbers('trash-truck', { start: 0, end: 5 }),
      frameRate: 12,
      repeat: -1,
    })

    const spawnCar = (goingRight) => {
      // El camión solo va a la izquierda; aparece a veces en ese carril
      const isTruck = !goingRight && Math.random() < 0.1
      const key  = isTruck ? 'trash-truck' : Phaser.Utils.Array.GetRandom(CAR_VARIANTS)
      const anim = isTruck ? 'trash-truck-left' : (goingRight ? `${key}-right` : `${key}-left`)
      const vw   = (isTruck ? 256 : 160) * scale   // ancho del vehículo escalado

      // Carril de abajo (36.5) para el que va a la derecha; el de arriba
      // (34.5) para el que va a la izquierda.
      const tileY = goingRight ? 36.5 : 34.5
      const y = bgTop + tileY * TILE * scale
      const car = this.add
        .sprite(goingRight ? -vw : this.scale.width, y, key)
        .setOrigin(0, 0)
        .setScale(scale)
        .play(anim)
      this.tweens.add({
        targets: car,
        x: goingRight ? this.scale.width : -vw,   // sale por el lado opuesto
        duration: 5500,
        ease: 'Linear',
        onComplete: () => car.destroy(),
      })
    }

    // Cada carril con su propio ritmo independiente (intervalo 4-8s)
    const scheduleLane = (goingRight) => {
      this.time.delayedCall(Phaser.Math.Between(4000, 8000), () => {
        spawnCar(goingRight)
        scheduleLane(goingRight)
      })
    }
    spawnCar(true)        // primer auto en cada carril
    spawnCar(false)
    scheduleLane(true)    // carril de la derecha (→)
    scheduleLane(false)   // carril de la izquierda (←)

    // Reproducir la música
    const music = this.sound.add('menu-music', {
      volume: 0.2,   // volumen entre 0 y 1
      loop: true     // loop infinito
    })
    music.play()
  }
}