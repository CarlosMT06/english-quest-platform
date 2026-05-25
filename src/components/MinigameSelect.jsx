const MINIGAMES = [
  {
    id: 'listen-choose',
    name: 'Listen & Choose',
    desc: 'Hear the word, pick the right answer',
    icon: '🎧',
    ready: true,
  },
  {
    id: 'word-scramble',
    name: 'Word Scramble',
    desc: 'Unscramble the letters to form the word',
    icon: '🔤',
    ready: false,
  },
  {
    id: 'fill-blank',
    name: 'Fill the Blank',
    desc: 'Complete the sentence with the right word',
    icon: '✏️',
    ready: false,
  },
  {
    id: 'vocab-match',
    name: 'Vocab Match',
    desc: 'Match words with their definitions',
    icon: '🃏',
    ready: false,
  },
  {
    id: 'pronunciation',
    name: 'Pronunciation',
    desc: 'Practice saying the words correctly',
    icon: '🗣️',
    ready: false,
  },
  {
    id: 'sentence-builder',
    name: 'Sentence Builder',
    desc: 'Put the words in the right order',
    icon: '🧩',
    ready: false,
  },
]

export default function MinigameSelect({ playerName, onSelect, onBack }) {
  return (
    <div style={{
      background: '#0f1a0f',
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
          onClick={onBack}
          style={{
            background: 'transparent',
            border: '1px solid rgba(217,119,6,0.4)',
            color: '#fbbf24',
            borderRadius: 10,
            padding: '6px 16px',
            fontSize: 13,
            cursor: 'pointer',
            marginBottom: 28,
            fontFamily: 'Nunito',
          }}
        >
          ← Back
        </button>

        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#fbbf24', fontSize: 12, letterSpacing: '0.12em',
                       textTransform: 'uppercase', marginBottom: 8 }}>
            Unit 4 · Take Care
          </p>
          <h1 style={{ color: '#fff', fontSize: 36, fontWeight: 600,
                        margin: 0, marginBottom: 6 }}>
            Select a Minigame
          </h1>
          <p style={{ color: 'rgba(253,230,138,0.6)', fontSize: 14, margin: 0 }}>
            Welcome, <span style={{ color: '#fde68a' }}>{playerName}</span>. Choose where to start.
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
            onClick={() => mg.ready && onSelect(mg.id)}
            style={{
              background: mg.ready
                ? 'rgba(20,35,20,0.9)'
                : 'rgba(15,20,15,0.6)',
              border: mg.ready
                ? '1px solid rgba(217,119,6,0.5)'
                : '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: '24px 20px',
              textAlign: 'left',
              cursor: mg.ready ? 'pointer' : 'not-allowed',
              transition: 'border-color 0.15s, background 0.15s',
              opacity: mg.ready ? 1 : 0.55,
            }}
            onMouseEnter={e => {
              if (!mg.ready) return
              e.currentTarget.style.borderColor = '#d97706'
              e.currentTarget.style.background = 'rgba(30,50,20,0.95)'
            }}
            onMouseLeave={e => {
              if (!mg.ready) return
              e.currentTarget.style.borderColor = 'rgba(217,119,6,0.5)'
              e.currentTarget.style.background = 'rgba(20,35,20,0.9)'
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 10 }}>{mg.icon}</div>
            <div style={{ display: 'flex', alignItems: 'center',
                           gap: 8, marginBottom: 6 }}>
              <span style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>
                {mg.name}
              </span>
              {!mg.ready && (
                <span style={{
                  background: 'rgba(100,100,100,0.3)',
                  color: '#9ca3af',
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 20,
                  fontWeight: 500,
                  letterSpacing: '0.06em',
                }}>
                  SOON
                </span>
              )}
            </div>
            <p style={{ color: 'rgba(253,230,138,0.6)', fontSize: 12,
                         margin: 0, lineHeight: 1.5 }}>
              {mg.desc}
            </p>
            <div style={{
              marginTop: 14,
              fontSize: 11,
              color: mg.ready ? '#d97706' : '#4b5563',
              fontWeight: 600,
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
