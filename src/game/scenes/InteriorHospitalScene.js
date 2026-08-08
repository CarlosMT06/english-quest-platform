import { MapTestScene } from './MapTestScene'

// Interior del hospital (nuevo, hecho en Tiled). Reutiliza toda la lógica de
// MapTestScene (Matter, colisiones por forma, Y-sort, triggers, idle, pasos);
// solo cambia qué archivos de mapa carga.
export class InteriorHospitalScene extends MapTestScene {
  constructor() {
    super('InteriorHospitalScene')
  }

  mapConfig() {
    return {
      mapKey:  'interior-map',
      tmj:     '/assets/maps/InteriorHospital.optimized.tmj',
      packed:  { tsName: 'InteriorHospital-packed', key: 'interior-packed', png: '/assets/maps/InteriorHospital-packed.png' },
      objects: { key: 'interior-objects', png: '/assets/maps/InteriorHospital-objects.png' },
      ysort:   { key: 'interior-ysort', json: '/assets/maps/InteriorHospital-ysort.json' },
      spawn:   { x: 8, y: 8 },   // tile de aparición (ajustable)
      speed:   3.5,                  // más lento que el exterior (ciudad usa 4.2)
      minigameKey: 'listen-choose-spatial',
      mapHelpKey:  'map-hospital',
    }
  }
}
