import { useState, useEffect } from 'react'
import { playSfx } from '../../utils/sfx'
import { scoreMessage } from '../../utils/scoreMessage'
import { DEFAULT_PALETTE } from '../../theme/palettes'
import Celebration from '../Celebration'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const MAX_WRONG = 10

function pickRounds(words, count) {
  const shuffled = [...words].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(count, words.length)).map(w => w.word.toUpperCase())
}

function HangmanDrawing({ wrongCount, gallows = '#2D3436' }) {
  const g = { stroke: gallows, strokeWidth: 3, strokeLinecap: 'round' }

  // Orden de aparición (1..10): 4 palos de la horca + 6 partes del cuerpo.
  // Toda la figura usa el mismo color oscuro (gallows).
  const parts = [
    { t: 'line',   a: { x1: 10,  y1: 200, x2: 90,  y2: 200 }, s: g },
    { t: 'line',   a: { x1: 50,  y1: 200, x2: 50,  y2: 10  }, s: g },
    { t: 'line',   a: { x1: 50,  y1: 10,  x2: 140, y2: 10  }, s: g },
    { t: 'line',   a: { x1: 140, y1: 10,  x2: 140, y2: 38  }, s: g },
    { t: 'circle', a: { cx: 140, cy: 53,  r: 15, fill: 'none' }, s: g },
    { t: 'line',   a: { x1: 140, y1: 68,  x2: 140, y2: 118 }, s: g },
    { t: 'line',   a: { x1: 140, y1: 82,  x2: 114, y2: 102 }, s: g },
    { t: 'line',   a: { x1: 140, y1: 82,  x2: 166, y2: 102 }, s: g },
    { t: 'line',   a: { x1: 140, y1: 118, x2: 114, y2: 148 }, s: g },
    { t: 'line',   a: { x1: 140, y1: 118, x2: 166, y2: 148 }, s: g },
  ]

  const draw = (p, key, opacity) => {
    const common = { ...p.s, strokeOpacity: opacity, key }
    return p.t === 'circle'
      ? <circle {...p.a} {...common} />
      : <line   {...p.a} {...common} />
  }

  return (
    <svg viewBox="0 0 200 210" style={{ width: 260, height: 260 }}>
      {/* Guía tenue: dónde irá cada palo/parte */}
      {parts.map((p, i) => draw(p, `guide-${i}`, 0.14))}
      {/* Partes sólidas según los fallos */}
      {parts.map((p, i) => (wrongCount >= i + 1 ? draw(p, `solid-${i}`, 1) : null))}
    </svg>
  )
}

export default function HangmanUI({ unitData, playerName, score, onScoreChange, palette = DEFAULT_PALETTE }) {
  const { bg, soft, accent, primary, dark } = palette
  const config = unitData.minigames['hangman']
  const audioBase = unitData.paths.audioHangman

  // "FEVER" → "Fever.mp3" (los archivos están capitalizados)
  function playWordAudio(w) {
    if (!w) return
    const name = w.charAt(0) + w.slice(1).toLowerCase()
    const audio = new Audio(audioBase + name + '.mp3')
    audio.play().catch(() => {})
  }
  const [rounds]       = useState(() => pickRounds(config.words, config.rounds))
  const [roundIndex,   setRoundIndex]   = useState(0)
  const [guessed,      setGuessed]      = useState(new Set())
  const [wrongCount,   setWrongCount]   = useState(0)
  const [roundStatus,  setRoundStatus]  = useState('playing') // 'playing' | 'won' | 'lost'
  const [finished,     setFinished]     = useState(false)

  const word = rounds[roundIndex] ?? ''

  const revealed  = word.split('').every(l => guessed.has(l))
  const lost      = wrongCount >= MAX_WRONG

  // Puntos por ronda repartidos entre las letras únicas de la palabra.
  // 3 rondas: la 1ª vale 334 y las otras 333 → 334+333+333 = 1000.
  // Se calcula al final para evitar redondeo: palabra completa = base exacta,
  // palabra a medias = crédito parcial por las letras correctas acertadas.
  function roundPoints() {
    const unique = new Set(word.replace(/ /g, '').split(''))
    if (unique.size === 0) return 0
    const correct = [...unique].filter(l => guessed.has(l)).length
    const base = roundIndex === 0 ? 334 : 333
    return Math.round(base * correct / unique.size)
  }

  useEffect(() => {
    if (roundStatus !== 'playing') return
    if (revealed) {
      setRoundStatus('won')
      onScoreChange(prev => prev + roundPoints())
      playWordAudio(word)
      setTimeout(advanceRound, 1400)
    } else if (lost) {
      setRoundStatus('lost')
      onScoreChange(prev => prev + roundPoints())
      playWordAudio(word)
      setTimeout(advanceRound, 2000)
    }
  }, [guessed, wrongCount])

  function advanceRound() {
    if (roundIndex < rounds.length - 1) {
      setRoundIndex(prev => prev + 1)
      setGuessed(new Set())
      setWrongCount(0)
      setRoundStatus('playing')
    } else {
      setFinished(true)
    }
  }

  function handleGuess(letter) {
    if (guessed.has(letter) || roundStatus !== 'playing') return
    const next = new Set(guessed).add(letter)
    setGuessed(next)
    if (word.includes(letter)) {
      playSfx('correct')
    } else {
      playSfx('wrong')
      setWrongCount(prev => prev + 1)
    }
  }

  // Teclado físico: adivinar con las teclas A-Z (además del clic)
  useEffect(() => {
    const onKey = (e) => {
      const letter = e.key.toUpperCase()
      if (letter.length === 1 && letter >= 'A' && letter <= 'Z') handleGuess(letter)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [word, guessed, roundStatus])

  if (finished) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: bg, gap: 18, fontFamily: 'Nunito',
      }}>
        <Celebration />
        <div style={{ color: dark, fontSize: 34, fontWeight: 800 }}>
          {scoreMessage(score)}
        </div>
        <div style={{
          color: '#fff', fontSize: 18, fontWeight: 800,
          background: primary, padding: '10px 32px', borderRadius: 50,
          boxShadow: '0 6px 18px rgba(0,0,0,0.2)',
        }}>
          ⭐ {score} pts
        </div>
      </div>
    )
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center',
      background: bg, padding: '24px 40px 32px',
      fontFamily: 'Nunito', gap: 32, position: 'relative', overflow: 'hidden',
    }}>

      {/* Decorative blobs */}
      <div style={{ position: 'absolute', top: -55, right: -55, width: 210, height: 210, borderRadius: '50%', background: primary + '16', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 30, left: -75, width: 250, height: 250, borderRadius: '50%', background: accent + '28', pointerEvents: 'none' }} />

      {/* Progress */}
      <div style={{ width: '100%', maxWidth: 900, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <span style={{
          color: '#fff', fontSize: 17, fontWeight: 800,
          background: primary, padding: '7px 24px', borderRadius: 50,
          boxShadow: '0 3px 10px rgba(0,0,0,0.18)',
        }}>
          {roundIndex + 1} / {rounds.length}
        </span>
      </div>

      {/* Main area: drawing + word */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 72, flex: 0 }}>
        {/* Hangman SVG */}
        <div style={{
          background: '#fff', borderRadius: 20,
          border: `2.5px solid ${roundStatus === 'lost' ? '#FA8071' : roundStatus === 'won' ? '#4CAB4D' : accent}`,
          boxShadow: '0 4px 14px rgba(0,0,0,0.10)',
          padding: '10px 16px',
          transition: 'border-color 0.3s',
        }}>
          <HangmanDrawing wrongCount={wrongCount} gallows={dark} />
        </div>

        {/* Word + status */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          {/* Letter blanks — agrupadas por palabra (no se parten palabras) */}
          <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 900 }}>
            {word.split(' ').map((chunk, wi) => (
              <div key={wi} style={{ display: 'flex', gap: 10, flexWrap: 'nowrap' }}>
                {chunk.split('').map((letter, i) => {
                  const show = guessed.has(letter) || roundStatus === 'lost'
                  return (
                    <div key={i} style={{
                      width: 52, height: 68,
                      borderBottom: `4px solid ${
                        roundStatus === 'lost' && !guessed.has(letter)
                          ? '#FA8071'
                          : guessed.has(letter) ? '#4CAB4D' : accent
                      }`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 34, fontWeight: 800,
                      color: roundStatus === 'lost' && !guessed.has(letter) ? '#FA8071' : dark,
                      transition: 'color 0.2s',
                    }}>
                      {show ? letter : ''}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Round result message */}
          {roundStatus === 'won' && (
            <div style={{
              background: '#4CAB4D', color: '#fff',
              fontSize: 15, fontWeight: 800,
              padding: '6px 22px', borderRadius: 50,
              boxShadow: '0 3px 12px rgba(76,171,77,0.4)',
            }}>
              ✅ Correct! +50 pts
            </div>
          )}
          {roundStatus === 'lost' && (
            <div style={{
              background: '#FA8071', color: '#fff',
              fontSize: 15, fontWeight: 800,
              padding: '6px 22px', borderRadius: 50,
              boxShadow: '0 3px 12px rgba(250,128,113,0.4)',
            }}>
              ❌ The word was: {word}
            </div>
          )}
        </div>
      </div>

      {/* Alphabet keyboard */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 10,
        justifyContent: 'center', maxWidth: 780,
      }}>
        {ALPHABET.map(letter => {
          const isGuessed = guessed.has(letter)
          const isCorrect = isGuessed && word.includes(letter)
          const isWrong   = isGuessed && !word.includes(letter)
          return (
            <button
              key={letter}
              onClick={() => handleGuess(letter)}
              disabled={isGuessed || roundStatus !== 'playing'}
              style={{
                width: 56, height: 56,
                background: isCorrect ? '#4CAB4D' : isWrong ? '#FFF0EE' : '#ffffff',
                border: `2.5px solid ${isCorrect ? '#3a8f3b' : isWrong ? '#FA8071' : accent}`,
                borderRadius: 14,
                color: isCorrect ? '#fff' : isWrong ? '#FA8071' : dark,
                fontSize: 22, fontWeight: 800,
                cursor: isGuessed || roundStatus !== 'playing' ? 'default' : 'pointer',
                opacity: isWrong ? 0.5 : 1,
                transition: 'background 0.15s, border-color 0.15s',
                fontFamily: 'Nunito',
              }}
            >
              {letter}
            </button>
          )
        })}
      </div>

    </div>
  )
}
