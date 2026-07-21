import { useState, useEffect } from 'react'
import { playSfx } from '../../utils/sfx'
import { scoreMessage } from '../../utils/scoreMessage'
import { DEFAULT_PALETTE } from '../../theme/palettes'
import Celebration from '../Celebration'
import LogoBar from '../LogoBar'

function pickRounds(items, count) {
  return [...items]
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(count, items.length))
}

const shuffle = arr => [...arr].sort(() => Math.random() - 0.5)

// Letras de la palabra (sin espacios), en mayúscula
const wordLetters = w => (w ?? '').toUpperCase().replace(/ /g, '').split('')

export default function FillBlankUI({ unitData, score, onScoreChange, palette = DEFAULT_PALETTE }) {
  const { bg, soft, accent, primary, dark } = palette
  const config    = unitData.minigames['fill-blank']
  const imgBase   = unitData.paths.images
  const audioBase = unitData.paths.audioFillBlank

  // "COLD" → "Cold.mp3" (los archivos están capitalizados)
  function playWordAudio(w) {
    if (!w) return
    const name = w.charAt(0) + w.slice(1).toLowerCase()
    new Audio(audioBase + name + '.mp3').play().catch(() => {})
  }

  const [rounds] = useState(() => pickRounds(config.items, config.rounds))
  const [roundIndex, setRoundIndex] = useState(0)
  const [scrambled, setScrambled]   = useState(() => shuffle(wordLetters(rounds[0]?.word)))
  const [placed, setPlaced]         = useState([])          // índices de fichas usadas, en orden
  const [status, setStatus]         = useState('playing')   // 'playing' | 'won' | 'wrong'
  const [fails, setFails]           = useState(0)           // intentos fallidos de la ronda
  const [finished, setFinished]     = useState(false)

  const item     = rounds[roundIndex] ?? { word: '', image: '', sentence: '___' }
  const letters  = wordLetters(item.word)
  const image    = imgBase + item.image
  const [before, after] = (item.sentence ?? '___').split('___')

  const built = placed.map(idx => scrambled[idx]).join('')

  function advance() {
    if (roundIndex < rounds.length - 1) {
      const nextWord = rounds[roundIndex + 1]?.word
      setRoundIndex(prev => prev + 1)
      setScrambled(shuffle(wordLetters(nextWord)))
      setPlaced([])
      setFails(0)
      setStatus('playing')
    } else {
      setFinished(true)
    }
  }

  function handleTile(idx) {
    if (status !== 'playing' || placed.includes(idx)) return
    const next = [...placed, idx]
    setPlaced(next)

    if (next.length === letters.length) {
      const answer = next.map(i => scrambled[i]).join('')
      if (answer === letters.join('')) {
        // 200 por ronda; −25 por cada intento fallido previo (mín. 0)
        const gained = Math.max(0, 200 - 25 * fails)
        playSfx('correct')
        setStatus('won')
        onScoreChange(prev => prev + gained)
        setTimeout(() => playWordAudio(item.word), 500)   // 0.5s tras el chime
        setTimeout(advance, 3000)                          // pausa para escuchar la oración
      } else {
        playSfx('wrong')
        setStatus('wrong')
        setFails(prev => prev + 1)
        setTimeout(() => { setPlaced([]); setStatus('playing') }, 800)
      }
    }
  }

  function handleDelete() {
    if (status !== 'playing') return
    setPlaced(prev => prev.slice(0, -1))
  }

  // Teclado físico: escribir letras coloca la ficha disponible; Backspace borra
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Backspace') { e.preventDefault(); handleDelete(); return }
      const letter = e.key.toUpperCase()
      if (letter.length === 1 && letter >= 'A' && letter <= 'Z') {
        const idx = scrambled.findIndex((l, i) => l === letter && !placed.includes(i))
        if (idx !== -1) handleTile(idx)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [scrambled, placed, status])

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

  const slotColor = status === 'won'   ? '#4CAB4D'
                  : status === 'wrong' ? '#FA8071'
                  : accent

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'flex-start', gap: 50,
      background: bg, padding: '24px 40px 80px',
      fontFamily: 'Nunito', position: 'relative', overflow: 'hidden',
    }}>

      {/* Decorative blobs */}
      <div style={{ position: 'absolute', top: -55, right: -55, width: 210, height: 210, borderRadius: '50%', background: primary + '16', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 30, left: -75, width: 250, height: 250, borderRadius: '50%', background: accent + '28', pointerEvents: 'none' }} />

      {/* Progress */}
      <div style={{ width: '100%', maxWidth: 900, display: 'flex', justifyContent: 'center', zIndex: 1 }}>
        <span style={{
          color: '#fff', fontSize: 17, fontWeight: 800,
          background: primary, padding: '7px 24px', borderRadius: 50,
          boxShadow: '0 3px 10px rgba(0,0,0,0.18)',
        }}>
          {roundIndex + 1} / {rounds.length}
        </span>
      </div>

      {/* Image clue */}
      <div style={{
        background: '#fff', borderRadius: 20,
        border: `2.5px solid ${status === 'won' ? '#4CAB4D' : status === 'wrong' ? '#FA8071' : accent}`,
        boxShadow: '0 4px 14px rgba(0,0,0,0.10)', padding: 12,
        transition: 'border-color 0.3s', zIndex: 1,
      }}>
        <img src={image} alt="" style={{ width: 180, height: 180, objectFit: 'contain' }} />
      </div>

      {/* Sentence with the blank being filled */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        justifyContent: 'center', maxWidth: 900, zIndex: 1,
        fontSize: 26, fontWeight: 800, color: dark,
      }}>
        {before && <span>{before}</span>}

        <span style={{ display: 'inline-flex', gap: 6 }}>
          {letters.map((_, k) => (
            <span key={k} style={{
              width: 34, height: 46,
              borderBottom: `4px solid ${slotColor}`,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: status === 'wrong' ? '#FA8071' : dark,
              transition: 'border-color 0.2s, color 0.2s',
            }}>
              {built[k] ?? ''}
            </span>
          ))}
        </span>

        {after && <span>{after}</span>}
      </div>

      {/* Scrambled letter tiles */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', maxWidth: 700, zIndex: 1 }}>
        {scrambled.map((letter, idx) => {
          const used = placed.includes(idx)
          return (
            <button
              key={idx}
              onClick={() => handleTile(idx)}
              disabled={used || status !== 'playing'}
              style={{
                width: 56, height: 56,
                background: used ? soft : '#ffffff',
                border: `2.5px solid ${accent}`,
                borderRadius: 12, color: dark,
                fontSize: 24, fontWeight: 800, fontFamily: 'Nunito',
                cursor: !used && status === 'playing' ? 'pointer' : 'default',
                opacity: used ? 0.3 : 1,
                transition: 'opacity 0.15s, background 0.15s',
              }}
            >
              {letter}
            </button>
          )
        })}

        {/* Delete */}
        <button
          onClick={handleDelete}
          disabled={placed.length === 0 || status !== 'playing'}
          style={{
            width: 66, height: 56,
            background: soft, border: `2.5px solid ${accent}`,
            borderRadius: 12, color: dark,
            fontSize: 22, fontWeight: 800, fontFamily: 'Nunito',
            cursor: placed.length > 0 && status === 'playing' ? 'pointer' : 'default',
            opacity: placed.length > 0 && status === 'playing' ? 1 : 0.5,
          }}
        >
          ⌫
        </button>
      </div>

      <LogoBar palette={palette} />
    </div>
  )
}
