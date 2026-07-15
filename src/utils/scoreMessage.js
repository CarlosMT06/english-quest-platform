// Mensaje de cierre según el puntaje (escala 0–1000), compartido por
// todas las pantallas de puntaje de los minijuegos.
export function scoreMessage(score) {
  if (score >= 900) return '⭐ Great job!'
  if (score >= 700) return '🌟 Well done!'
  if (score >= 500) return '👍 Good job!'
  if (score >= 300) return '😊 Keep trying!'
  if (score >= 100) return '💪 You can do it!'
  return "🌱 Let's try again!"
}
