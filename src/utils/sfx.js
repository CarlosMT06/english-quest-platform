// Efectos de sonido globales, compartidos por todos los minijuegos.
// Uso: import { playSfx } from '../../utils/sfx'  →  playSfx('correct') / playSfx('wrong')

const SOURCES = {
  correct: '/assets/sfx/correct.mp3',
  wrong:   '/assets/sfx/wrong.mp3',
  click:   '/assets/sfx/click.mp3',
  victory: '/assets/sfx/victory.mp3',
  defeat:  '/assets/sfx/defeat.mp3',
  step:    '/assets/sfx/step.mp3',
}

const VOLUME = 0.6

// Volumen específico por efecto (los pasos van más bajos, son de fondo)
const VOLUMES = {
  step: 0.25,
}

// Precarga una vez
const cache = {}
for (const [name, src] of Object.entries(SOURCES)) {
  const audio = new Audio(src)
  audio.preload = 'auto'
  audio.volume = VOLUMES[name] ?? VOLUME
  cache[name] = audio
}

export function playSfx(name) {
  const base = cache[name]
  if (!base) return
  // Clonar permite que se solapen reproducciones rápidas sin cortarse
  const audio = base.cloneNode()
  audio.volume = VOLUMES[name] ?? VOLUME
  audio.play().catch(() => {})
}
