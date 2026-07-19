const MINIGAMES = [
  {
    id: 'listen-choose',
    name: 'Listen & Choose',
    desc: 'Hear the word and pick the correct written answer',
    icon: '🎧',
    ready: true,
  },
  {
    id: 'listen-image',
    name: 'Listen & Point',
    desc: 'Hear the phrase and choose the matching image',
    icon: '🖼️',
    ready: true,
  },
  {
    id: 'memory-match',
    name: 'Memory Match',
    desc: 'Flip cards to find matching word and image pairs',
    icon: '🃏',
    ready: true,
  },
  {
    id: 'true-false',
    name: 'True or False',
    desc: 'Read the text and decide which statements are true',
    icon: '✅',
    ready: true,
  },
  {
    id: 'hangman',
    name: 'Hangman',
    desc: 'Guess the letters to complete the hidden word',
    icon: '🔤',
    ready: true,
  },
  {
    id: 'fill-blank',
    name: 'Fill the Blank',
    desc: 'Look at the image clue and complete the word',
    icon: '✏️',
    ready: true,
  },
]

import { SELECT_PALETTE as P } from '../theme/palettes'
import { playSfx } from '../utils/sfx'

export default function MinigameSelect({ playerName, onSelect, onBack }) {
  return (
    <div style={{
      background: P.bg,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '40px 24px',
      fontFamily: 'Nunito',
    }}>
      {/* Header */}
      <div style={{ width: '100%', maxWidth: 860, marginBottom: 36 }}>
        <button
          onClick={() => { playSfx('click'); onBack() }}
          style={{
            background: 'transparent',
            border: `1.5px solid ${P.accent}`,
            color: P.primary,
            borderRadius: 10,
            padding: '6px 16px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            marginBottom: 28,
            fontFamily: 'Nunito',
          }}
        >
          ← Back
        </button>

        <div style={{ textAlign: 'center' }}>
          <p style={{ color: P.primary, fontSize: 12, letterSpacing: '0.12em',
                       textTransform: 'uppercase', marginBottom: 8, fontWeight: 700 }}>
            Grade 4 · Unit 4 · Take Care
          </p>
          <h1 style={{ color: P.dark, fontSize: 36, fontWeight: 700,
                        margin: 0, marginBottom: 6 }}>
            Select a Minigame
          </h1>
          <p style={{ color: 'rgba(12,78,76,0.6)', fontSize: 14, margin: 0 }}>
            Choose a minigame to start.
          </p>
        </div>
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 18,
        width: '100%',
        maxWidth: 860,
      }}>
        {MINIGAMES.map((mg, i) => (
          <button
            key={mg.id}
            onClick={() => { if (mg.ready) { playSfx('click'); onSelect(mg.id) } }}
            style={{
              background: mg.ready ? '#ffffff' : P.soft,
              border: mg.ready
                ? `1.5px solid ${P.primary}`
                : '1.5px solid rgba(12,78,76,0.25)',
              borderRadius: 16,
              padding: '24px 20px',
              textAlign: 'left',
              cursor: mg.ready ? 'pointer' : 'not-allowed',
              transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
              opacity: mg.ready ? 1 : 0.6,
              boxShadow: mg.ready ? '0 4px 14px rgba(12,78,76,0.08)' : 'none',
            }}
            onMouseEnter={e => {
              if (!mg.ready) return
              e.currentTarget.style.borderColor = P.dark
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(26,158,155,0.22)'
            }}
            onMouseLeave={e => {
              if (!mg.ready) return
              e.currentTarget.style.borderColor = P.primary
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(12,78,76,0.08)'
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 10 }}>{mg.icon}</div>
            <div style={{ display: 'flex', alignItems: 'center',
                           gap: 8, marginBottom: 6 }}>
              <span style={{ color: P.dark, fontSize: 16, fontWeight: 700 }}>
                {mg.name}
              </span>
              {!mg.ready && (
                <span style={{
                  background: 'rgba(12,78,76,0.12)',
                  color: '#1a1a1a',
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 20,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                }}>
                  SOON
                </span>
              )}
            </div>
            <p style={{ color: '#1a1a1a', fontSize: 12,
                         margin: 0, lineHeight: 1.5 }}>
              {mg.desc}
            </p>
            <div style={{
              marginTop: 14,
              fontSize: 11,
              color: mg.ready ? '#1a1a1a' : 'rgba(0,0,0,0.4)',
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}>
              {i + 1} / 6
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
