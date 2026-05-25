import * as Phaser from 'phaser'

export class ListenChooseScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ListenChooseScene' })
  }

  create() {
    this.add.rectangle(
      this.scale.width  / 2,
      this.scale.height / 2,
      this.scale.width,
      this.scale.height,
      0x0f1a0f
    )
  }
}
