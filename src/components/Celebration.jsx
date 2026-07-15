import { useEffect } from 'react'
import confetti from 'canvas-confetti'
import { playSfx } from '../utils/sfx'

// Overlay de victoria: reproduce victory.mp3 y lanza confeti con canvas-confetti.
// La librería crea su propio canvas a pantalla completa, así que no renderiza DOM.
export default function Celebration() {
  useEffect(() => {
    playSfx('victory')

    // Ráfaga inicial desde el centro-abajo
    confetti({ particleCount: 140, spread: 100, startVelocity: 45, origin: { y: 0.65 } })

    // Cañones laterales durante ~2.5s
    const end = Date.now() + 2500
    const interval = setInterval(() => {
      if (Date.now() > end) { clearInterval(interval); return }
      confetti({ particleCount: 45, angle: 60,  spread: 75, origin: { x: 0, y: 0.75 } })
      confetti({ particleCount: 45, angle: 120, spread: 75, origin: { x: 1, y: 0.75 } })
    }, 320)

    return () => clearInterval(interval)
  }, [])

  return null
}
