import { useState } from 'react'
import { playSfx } from '../../utils/sfx'
import { scoreMessage } from '../../utils/scoreMessage'
import { DEFAULT_PALETTE } from '../../theme/palettes'
import Celebration from '../Celebration'
import LogoBar from '../LogoBar'
import { trueOrFalseTexts } from '../../content/grade4/trueFalseTexts'

function pickText() {
  return trueOrFalseTexts[Math.floor(Math.random() * trueOrFalseTexts.length)]
}

export default function TrueFalseUI({ score, onScoreChange, palette = DEFAULT_PALETTE }) {
  const { bg, soft, accent, primary, dark } = palette

  const [item] = useState(() => pickText())
  const statements = item.statements

  const [index, setIndex]             = useState(0)
  const [selected, setSelected]       = useState(null)   // true/false elegido, o null
  const [correctCount, setCorrectCount] = useState(0)
  const [finished, setFinished]       = useState(false)

  const statement = statements[index]
  const locked    = selected !== null

  function handleAnswer(value) {
    if (locked) return
    setSelected(value)
    const isCorrect = value === statement.answer
    playSfx(isCorrect ? 'correct' : 'wrong')
    if (isCorrect) setCorrectCount(c => c + 1)

    setTimeout(() => {
      if (index < statements.length - 1) {
        setIndex(i => i + 1)
        setSelected(null)
      } else {
        // Puntaje sobre 1000 según aciertos (redondeado)
        const finalCorrect = correctCount + (isCorrect ? 1 : 0)
        onScoreChange(Math.round(1000 * finalCorrect / statements.length))
        setFinished(true)
      }
    }, 1300)
  }

  // Estilo de cada botón (True/False) según el estado
  function btnStyle(value) {
    const base = {
      flex: 1, padding: '13px 0', borderRadius: 14,
      fontSize: 19, fontWeight: 800, fontFamily: 'Nunito',
      cursor: locked ? 'default' : 'pointer',
      transition: 'all 0.15s',
    }
    if (!locked) {
      return { ...base, background: '#ffffff', border: `3px solid ${accent}`, color: dark }
    }
    if (value === statement.answer) {
      return { ...base, background: '#4CAB4D', border: '3px solid #3a8f3b', color: '#fff' }
    }
    if (value === selected) {
      return { ...base, background: '#FFF0EE', border: '3px solid #FA8071', color: '#FA8071' }
    }
    return { ...base, background: '#ffffff', border: `3px solid ${accent}`, color: dark, opacity: 0.5 }
  }

  if (finished) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: bg, gap: 18, fontFamily: 'Nunito',
      }}>
        <Celebration />
        <div style={{ color: dark, fontSize: 34, fontWeight: 800 }}>{scoreMessage(score)}</div>
        <div style={{
          color: '#fff', fontSize: 18, fontWeight: 800,
          background: primary, padding: '10px 32px', borderRadius: 50,
          boxShadow: '0 6px 18px rgba(0,0,0,0.2)',
        }}>
          ⭐ {score} pts
        </div>
        <LogoBar palette={palette} />
      </div>
    )
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: bg, padding: '20px 24px 76px',
      fontFamily: 'Nunito', gap: 16, position: 'relative', overflow: 'hidden',
    }}>
      {/* Blobs decorativos */}
      <div style={{ position: 'absolute', top: -55, right: -55, width: 210, height: 210, borderRadius: '50%', background: primary + '16', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 30, left: -75, width: 250, height: 250, borderRadius: '50%', background: accent + '28', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 980, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, flex: 1, minHeight: 0 }}>

        {/* Texto (título + párrafo) — desplazable */}
        <div style={{
          width: '100%', background: '#ffffff', borderRadius: 18,
          border: `2px solid ${accent}`, boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
          padding: '16px 20px', overflowY: 'auto', flex: 1, minHeight: 80,
        }}>
          <h3 style={{ color: primary, fontSize: 26, fontWeight: 800, margin: '0 0 10px', textAlign: 'center' }}>
            {item.title}
          </h3>
          <p style={{ color: dark, fontSize: 19, lineHeight: 1.55, margin: 0, whiteSpace: 'pre-line' }}>
            {item.text}
          </p>
        </div>

        {/* Progreso */}
        <span style={{
          color: '#fff', fontSize: 16, fontWeight: 800,
          background: primary, padding: '6px 22px', borderRadius: 50,
          boxShadow: '0 3px 10px rgba(0,0,0,0.18)',
        }}>
          {index + 1} / {statements.length}
        </span>

        {/* Afirmación */}
        <div style={{
          color: dark, fontSize: 23, fontWeight: 700, textAlign: 'center',
          minHeight: 56, display: 'flex', alignItems: 'center',
        }}>
          {statement.text}
        </div>

        {/* Botones True / False */}
        <div style={{ display: 'flex', gap: 14, width: '100%', maxWidth: 460 }}>
          <button onClick={() => handleAnswer(true)}  style={btnStyle(true)}>✓ True</button>
          <button onClick={() => handleAnswer(false)} style={btnStyle(false)}>✗ False</button>
        </div>
      </div>

      <LogoBar palette={palette} />
    </div>
  )
}
