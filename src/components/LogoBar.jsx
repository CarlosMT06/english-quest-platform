import { DEFAULT_PALETTE } from '../theme/palettes'

// Barra inferior fija con los dos logos institucionales.
// Usa el tono claro (soft) de la paleta del minijuego.
export default function LogoBar({ palette = DEFAULT_PALETTE }) {
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 15,
      background: palette.soft,
      boxShadow: '0 -3px 14px rgba(0,0,0,0.12)',
      padding: '8px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.92)',
        borderRadius: 12, padding: '6px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <img src="/assets/logos/logo1.png" alt="" style={{ height: 36, display: 'block' }} />
        <div style={{ width: 1, height: 26, background: 'rgba(0,0,0,0.12)' }} />
        <img src="/assets/logos/logo2.png" alt="" style={{ height: 36, display: 'block' }} />
      </div>
    </div>
  )
}
