import { useState } from 'react'

const QUESTIONS = [
  {
    word: 'headache',
    options: ['Headache', 'Fever', 'Cough', 'Rash'],
    correct: 0
  },
  {
    word: 'stomachache',
    options: ['Runny nose', 'Stomachache', 'Sore throat', 'Rash'],
    correct: 1
  },
  {
    word: 'fever',
    options: ['Cough', 'Headache', 'Fever', 'Sneeze'],
    correct: 2
  },
  {
    word: 'sore throat',
    options: ['Sore throat', 'Fever', 'Rash', 'Cough'],
    correct: 0
  },
  {
    word: 'runny nose',
    options: ['Stomachache', 'Headache', 'Sneeze', 'Runny nose'],
    correct: 3
  }
]

export default function ListenChooseUI({ playerName, score, onScoreChange }) {
  const [questionIndex, setQuestionIndex] = useState(0)
  const [attempts, setAttempts]           = useState(3)
  const [selected, setSelected]           = useState(null)
  const [isPlaying, setIsPlaying]         = useState(false)
  const [finished, setFinished]           = useState(false)

  const question = QUESTIONS[questionIndex]

  // ── Audio TTS ────────────────────────────────────────────
  async function playAudio() {
    if (isPlaying) return
    setIsPlaying(true)

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: question.word })
      })
      const blob = await res.blob()
      const audio = new Audio(URL.createObjectURL(blob))
      audio.onended = () => setIsPlaying(false)
      audio.play()
    } catch {
      // Si la API no está disponible aún, solo muestra la palabra
      alert(`Word: ${question.word}`)
      setIsPlaying(false)
    }
  }

  // ── Respuesta ────────────────────────────────────────────
  function handleAnswer(index) {
    if (selected !== null || finished) return
    setSelected(index)

    const isCorrect = index === question.correct

    // Avisar a Phaser
    window.dispatchEvent(new CustomEvent('answer-result', {
      detail: { correct: isCorrect }
    }))

    if (isCorrect) {
      onScoreChange(prev => prev + 50)

      setTimeout(() => {
        if (questionIndex < QUESTIONS.length - 1) {
          setQuestionIndex(prev => prev + 1)
          setSelected(null)
          setAttempts(3)
        } else {
          setFinished(true)
        }
      }, 1200)

    } else {
      const newAttempts = attempts - 1
      setAttempts(newAttempts)

      setTimeout(() => setSelected(null), 900)
    }
  }

  // ── Estilos de opciones ──────────────────────────────────
  function getOptionStyle(index) {
    const base = {
      background: 'rgba(255,255,255,0.07)',
      border: '1.5px solid rgba(217,119,6,0.3)',
      borderRadius: 10,
      padding: '10px 8px',
      color: '#fff',
      cursor: 'pointer',
      fontSize: 14,
      fontFamily: 'Nunito, sans-serif'
    }

    if (selected === index) {
      return index === question.correct
        ? { ...base, background: 'rgba(34,197,94,0.2)',
            border: '1.5px solid #22c55e' }
        : { ...base, background: 'rgba(239,68,68,0.15)',
            border: '1.5px solid #ef4444' }
    }

    return base
  }

  if (finished) {
    return (
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: 'rgba(10,20,10,0.95)',
                    borderTop: '1px solid rgba(217,119,6,0.3)',
                    padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: 32 }}>🏆</div>
        <div style={{ color: '#fde68a', fontSize: 18,
                      fontWeight: 500, margin: '8px 0' }}>
          Great job, {playerName}!
        </div>
        <div style={{ color: '#fbbf24' }}>Final score: {score} pts</div>
      </div>
    )
  }

  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'rgba(10,20,10,0.88)',
                  borderTop: '1px solid rgba(217,119,6,0.3)',
                  zIndex: 10 }}>

      {/* Pregunta y botón de audio */}
      <div style={{ display: 'flex', alignItems: 'center',
                    gap: 16, padding: '12px 20px 8px' }}>
        <button onClick={playAudio} disabled={isPlaying}
          style={{ width: 48, height: 48, borderRadius: '50%',
                   background: isPlaying ? '#92400e' : '#d97706',
                   border: 'none', fontSize: 20, cursor: 'pointer',
                   flexShrink: 0 }}>
          {isPlaying ? '⏸' : '🔊'}
        </button>
        <div>
          <div style={{ color: '#fde68a', fontSize: 14, fontWeight: 500 }}>
            Listen and choose the correct word
          </div>
          <div style={{ color: 'rgba(253,230,138,0.55)', fontSize: 11,
                        marginTop: 2 }}>
            Press 🔊 to listen · Question {questionIndex + 1} of {QUESTIONS.length}
          </div>
        </div>
      </div>

      {/* Opciones */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
                    gap: 8, padding: '0 20px 8px' }}>
        {question.options.map((opt, i) => (
          <button key={i} onClick={() => handleAnswer(i)}
            style={getOptionStyle(i)}>
            <div style={{ fontSize: 10, color: 'rgba(253,230,138,0.5)',
                          marginBottom: 4 }}>
              {['A','B','C','D'][i]}
            </div>
            {opt}
          </button>
        ))}
      </div>

      {/* Intentos */}
      <div style={{ display: 'flex', justifyContent: 'center',
                    alignItems: 'center', gap: 4, paddingBottom: 12 }}>
        {[...Array(3)].map((_, i) => (
          <span key={i} style={{ fontSize: 16 }}>
            {i < attempts ? '❤️' : '🖤'}
          </span>
        ))}
        <span style={{ color: 'rgba(253,230,138,0.5)', fontSize: 11,
                        marginLeft: 6 }}>
          {attempts} attempt{attempts !== 1 ? 's' : ''} remaining
        </span>
      </div>
    </div>
  )
}