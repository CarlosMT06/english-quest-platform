// Paleta de colores por minijuego (para el "chrome": fondo, HUD, botones,
// texto). NO afecta los colores de acierto/error de las tarjetas, que se
// mantienen verde/coral en todos los juegos.
//
// Claves:
//   bg      — fondo principal
//   soft    — tono suave secundario
//   accent  — bordes/acentos neutros
//   primary — color fuerte (HUD, botón de audio, píldoras)
//   dark    — texto y acentos oscuros

export const DEFAULT_PALETTE = {
  bg:      '#F7F6F2',
  soft:    '#EAF6EA',
  accent:  '#7BC67E',
  primary: '#4CAB4D',
  dark:    '#2D3436',
}

export const PALETTES = {
  'listen-choose': {
    bg:      '#FFF7EF',
    soft:    '#F2E3D5',
    accent:  '#D8BFA8',
    primary: '#B27F5B',
    dark:    '#6B3F2A',
  },
  'listen-image': {
    bg:      '#FFFFFF',
    soft:    '#E7F1FB',
    accent:  '#9EC9F3',
    primary: '#2F78C8',
    dark:    '#173A5E',
  },
  'hangman': {
    bg:      '#FFF5F2',
    soft:    '#FFD4C9',
    accent:  '#FF8A7A',
    primary: '#D94A3A',
    dark:    '#5A1F1A',
  },
}

// Paleta para la pantalla de selección de minijuego
export const SELECT_PALETTE = {
  bg:      '#F3FBFB',
  soft:    '#CDEEEE',
  accent:  '#6FD0CC',
  primary: '#1A9E9B',
  dark:    '#0C4E4C',
}

export function getPalette(id) {
  return PALETTES[id] || DEFAULT_PALETTE
}
