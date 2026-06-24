import { useState, useEffect } from 'react'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const MAX_WRONG = 6

function pickRounds(words, count) {
  const shuffled = [...words].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(count, words.length)).map(w => w.word.toUpperCase())
}

function HangmanDrawing({ wrongCount }) {
  const s = { stroke: '#2D3436', strokeWidth: 3, strokeLinecap: 'round' }
  return (
    <svg viewBox="0 0 200 210" style={{ width: 180, height: 180 }}>
      {/* Gallows */}
      <line x1="10" y1="200" x2="90"  y2="200" {...s} />
      <line x1="50" y1="200" x2="50"  y2="10"  {...s} />
      <line x1="50" y1="10"  x2="140" y2="10"  {...s} />
      <line x1="140" y1="10" x2="140" y2="38"  {...s} />
      {/* Head */}
      {wrongCount >= 1 && <circle cx="140" cy="53" r="15" fill="none" stroke="#FA8071" strokeWidth="3" />}
      {/* Body */}
      {wrongCount >= 2 && <line x1="140" y1="68" x2="140" y2="118" {...s} stroke="#FA8071" />}
      {/* Left arm */}
      {wrongCount >= 3 && <line x1="140" y1="82" x2="114" y2="102" {...s} stroke="#FA8071" />}
      {/* Right arm */}
      {wrongCount >= 4 && <line x1="140" y1="82" x2="166" y2="102" {...s} stroke="#FA8071" />}
      {/* Left leg */}
      {wrongCount >= 5 && <line x1="140" y1="118" x2="114" y2="148" {...s} stroke="#FA8071" />}
      {/* Right leg */}
      {wrongCount >= 6 && <line x1="140" y1="118" x2="166" y2="148" {...s} stroke="#FA8071" />}
    </svg>
  )
}

export default function HangmanUI({ unitData, playerName, score, onScoreChange }) {
  const config = unitData.minigames['hangman']
  const [rounds]       = useState(() => pickRounds(config.words, config.rounds))
  const [roundIndex,   setRoundIndex]   = useState(0)
  const [guessed,      setGuessed]      = useState(new Set())
  const [wrongCount,   setWrongCount]   = useState(0)
  const [roundStatus,  setRoundStatus]  = useState('playing') // 'playing' | 'won' | 'lost'
  const [finished,     setFinished]     = useState(false)

  const word = rounds[roundIndex] ?? ''

  const revealed  = word.split('').every(l => guessed.has(l))
  const lost      = wrongCount >= MAX_WRONG

  useEffect(() => {
    if (roundStatus !== 'playing') return
    if (revealed) {
      setRoundStatus('won')
      onScoreChange(prev => prev + 50)
      setTimeout(advanceRound, 1400)
    } else if (lost) {
      setRoundStatus('lost')
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
    if (!word.includes(letter)) setWrongCount(prev => prev + 1)
  }

  if (finished) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#F7F6F2', gap: 18, fontFamily: 'Nunito',
      }}>
        <div style={{ fontSize: 72 }}>🏆</div>
        <div style={{ color: '#2D3436', fontSize: 28, fontWeight: 800 }}>
          Great job, {playerName}!
        </div>
        <div style={{
          color: '#fff', fontSize: 18, fontWeight: 800,
          background: '#F4A261', padding: '10px 32px', borderRadius: 50,
          boxShadow: '0 6px 18px rgba(244,162,97,0.45)',
        }}>
          ⭐ {score} pts
        </div>
      </div>
    )
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: '#F7F6F2', padding: '20px 32px 24px',
      fontFamily: 'Nunito', gap: 14, position: 'relative', overflow: 'hidden',
    }}>

      {/* Decorative blobs */}
      <div style={{ position: 'absolute', top: -55, right: -55, width: 210, height: 210, borderRadius: '50%', background: 'rgba(76,171,77,0.07)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 30, left: -75, width: 250, height: 250, borderRadius: '50%', background: 'rgba(63,224,208,0.06)', pointerEvents: 'none' }} />

      {/* Progress + wrong count */}
      <div style={{ width: '100%', maxWidth: 680, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          color: '#fff', fontSize: 13, fontWeight: 800,
          background: '#4CAB4D', padding: '5px 18px', borderRadius: 50,
          boxShadow: '0 3px 10px rgba(76,171,77,0.35)',
        }}>
          {roundIndex + 1} / {rounds.length}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {[...Array(MAX_WRONG)].map((_, i) => (
            <span key={i} style={{
              fontSize: 22,
              opacity: i >= wrongCount ? 1 : 0.2,
              transition: 'opacity 0.3s',
            }}>❤️</span>
          ))}
        </div>
      </div>

      {/* Main area: drawing + word */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 48, flex: 0 }}>
        {/* Hangman SVG */}
        <div style={{
          background: '#fff', borderRadius: 20,
          border: `2.5px solid ${roundStatus === 'lost' ? '#FA8071' : roundStatus === 'won' ? '#4CAB4D' : '#7BC67E'}`,
          boxShadow: '0 4px 14px rgba(0,0,0,0.07)',
          padding: '10px 16px',
          transition: 'border-color 0.3s',
        }}>
          <HangmanDrawing wrongCount={wrongCount} />
        </div>

        {/* Word + status */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          {/* Letter blanks */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 420 }}>
            {word.split('').map((letter, i) => {
              const show = guessed.has(letter) || roundStatus === 'lost'
              return (
                <div key={i} style={{
                  width: 36, height: 48,
                  borderBottom: `3px solid ${
                    roundStatus === 'lost' && !guessed.has(letter)
                      ? '#FA8071'
                      : guessed.has(letter) ? '#4CAB4D' : '#7BC67E'
                  }`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, fontWeight: 800,
                  color: roundStatus === 'lost' && !guessed.has(letter) ? '#FA8071' : '#2D3436',
                  transition: 'color 0.2s',
                }}>
                  {show ? letter : ''}
                </div>
              )
            })}
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
        display: 'flex', flexWrap: 'wrap', gap: 7,
        justifyContent: 'center', maxWidth: 520,
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
                width: 38, height: 38,
                background: isCorrect ? '#4CAB4D' : isWrong ? '#FFF0EE' : '#ffffff',
                border: `2px solid ${isCorrect ? '#3a8f3b' : isWrong ? '#FA8071' : '#7BC67E'}`,
                borderRadius: 10,
                color: isCorrect ? '#fff' : isWrong ? '#FA8071' : '#2D3436',
                fontSize: 14, fontWeight: 800,
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
