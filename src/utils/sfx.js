// Efectos de sonido globales, compartidos por todos los minijuegos.
// Uso: import { playSfx } from '../../utils/sfx'  →  playSfx('correct') / playSfx('wrong')

const SOURCES = {
  correct: '/assets/sfx/correct.mp3',
  wrong:   '/assets/sfx/wrong.mp3',
  click:   '/assets/sfx/click.mp3',
}

const VOLUME = 0.6

// Precarga una vez
const cache = {}
for (const [name, src] of Object.entries(SOURCES)) {
  const audio = new Audio(src)
  audio.preload = 'auto'
  audio.volume = VOLUME
  cache[name] = audio
}

export function playSfx(name) {
  const base = cache[name]
  if (!base) return
  // Clonar permite que se solapen reproducciones rápidas sin cortarse
  const audio = base.cloneNode()
  audio.volume = VOLUME
  audio.play().catch(() => {})
}
