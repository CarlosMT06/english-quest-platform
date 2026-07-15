import { useState, useEffect } from 'react'
import { playSfx } from '../../utils/sfx'
import { scoreMessage } from '../../utils/scoreMessage'
import { DEFAULT_PALETTE } from '../../theme/palettes'
import Celebration from '../Celebration'

function generateQuestions(vocab, count) {
  const shuffled = [...vocab].sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, Math.min(count, vocab.length))

  return selected.map(correct => {
    const others   = vocab.filter(v => v.id !== correct.id)
    const wrong    = [...others].sort(() => Math.random() - 0.5).slice(0, 3)
    const all      = [...wrong, correct].sort(() => Math.random() - 0.5)
    return {
      word:    correct.word,
      audio:   correct.audio,
      options: all.map(o => o.word),
      correct: all.findIndex(o => o.id === correct.id),
    }
  })
}

export default function ListenChooseUI({ unitData, playerName, score, onScoreChange, palette = DEFAULT_PALETTE }) {
  const { bg, soft, accent, primary, dark } = palette
  const base       = unitData.paths.audioChoose
  const vocabulary = unitData.vocabulary.map(v => ({ ...v, audio: base + v.audio }))
  const rounds     = unitData.minigames['listen-choose'].rounds

  const [questions] = useState(() => generateQuestions(vocabulary, rounds))

  // Preload all audio files at session start so they are buffered before the user presses play
  const [audioCache] = useState(() => {
    const cache = {}
    questions.forEach(q => {
      const audio = new Audio(q.audio)
      audio.preload = 'auto'
      audio.load()
      cache[q.audio] = audio
    })
    return cache
  })

  const [questionIndex, setQuestionIndex] = useState(0)
  const [selected, setSelected]           = useState(null)
  const [fails, setFails]                 = useState(0)   // fallos de la ronda actual
  const [isPlaying, setIsPlaying]         = useState(false)
  const [finished, setFinished]           = useState(false)
  const [audioReady, setAudioReady]       = useState(false)

  const question = questions[questionIndex]
  const locked   = selected !== null

  // Auto-play audio when a new round starts, waiting for buffer if needed
  useEffect(() => {
    const audio = audioCache[question.audio]

    function autoPlay() {
      setAudioReady(true)
      setIsPlaying(true)
      audio.currentTime = 0
      audio.onended = () => setIsPlaying(false)
      audio.onerror = () => setIsPlaying(false)
      audio.play().catch(() => setIsPlaying(false))
    }

    if (audio.readyState >= 3) {
      autoPlay()
    } else {
      setAudioReady(false)
      audio.addEventListener('canplaythrough', autoPlay, { once: true })
      return () => audio.removeEventListener('canplaythrough', autoPlay)
    }
  }, [questionIndex])

  function playAudio() {
    if (isPlaying) return
    setIsPlaying(true)
    const audio = audioCache[question.audio]
    audio.currentTime = 0
    audio.onended = () => setIsPlaying(false)
    audio.onerror = () => setIsPlaying(false)
    audio.play()
  }

  function handleAnswer(index) {
    if (locked || finished) return
    setSelected(index)
    const isCorrect = index === question.correct

    window.dispatchEvent(new CustomEvent('answer-result', { detail: { correct: isCorrect } }))
    playSfx(isCorrect ? 'correct' : 'wrong')

    if (isCorrect) {
      // 125 por ronda si es a la primera; −25 por cada fallo previo (mín. 0)
      const gained = Math.max(0, 125 - 25 * fails)
      onScoreChange(prev => prev + gained)
      setTimeout(() => {
        if (questionIndex < questions.length - 1) {
          setQuestionIndex(prev => prev + 1)
          setSelected(null)
          setFails(0)
        } else {
          setFinished(true)
        }
      }, 1300)
    } else {
      // Sin límite de fallos: se puede reintentar hasta acertar
      setFails(prev => prev + 1)
      setTimeout(() => setSelected(null), 950)
    }
  }

  function getCardProps(index) {
    const isSelected = selected === index
    const isCorrect  = index === question.correct

    if (isSelected && isCorrect) return {
      bg: '#4CAB4D', border: '2.5px solid #3a8f3b', color: '#ffffff',
      shadow: '0 8px 24px rgba(76,171,77,0.45)', labelColor: 'rgba(255,255,255,0.65)',
      extraClass: 'lc-pop',
    }
    if (isSelected && !isCorrect) return {
      bg: '#FFF0EE', border: '2.5px solid #FA8071', color: '#2D3436',
      shadow: '0 8px 24px rgba(250,128,113,0.35)', labelColor: '#FA8071',
      extraClass: 'lc-shake',
    }
    return {
      bg: '#ffffff', border: `2.5px solid ${accent}`, color: dark,
      shadow: '0 4px 14px rgba(0,0,0,0.10)', labelColor: accent,
      extraClass: '',
    }
  }

  if (finished) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: bg, gap: 18, fontFamily: 'Nunito',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: primary + '18', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 20, left: -80, width: 260, height: 260, borderRadius: '50%', background: accent + '30', pointerEvents: 'none' }} />
        <Celebration />
        <div style={{ color: dark, fontSize: 34, fontWeight: 800 }}>{scoreMessage(score)}</div>
        <div style={{
          color: '#ffffff', fontSize: 18, fontWeight: 800,
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
      background: bg, padding: '20px 48px 28px',
      fontFamily: 'Nunito', gap: 16, position: 'relative', overflow: 'hidden',
    }}>

      {/* Decorative blobs */}
      <div style={{ position: 'absolute', top: -55, right: -55, width: 210, height: 210, borderRadius: '50%', background: primary + '16', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', bottom: 30, left: -75, width: 250, height: 250, borderRadius: '50%', background: accent + '28', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', top: '42%', right: 24, width: 100, height: 100, borderRadius: '50%', background: soft, pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, flex: 1 }}>

        {/* Progress */}
        <div style={{ width: '100%', maxWidth: 700, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <span style={{
            color: '#ffffff', fontSize: 13, fontWeight: 800,
            background: primary, padding: '5px 18px', borderRadius: 50,
            boxShadow: '0 3px 10px rgba(0,0,0,0.18)', letterSpacing: '0.03em',
          }}>
            {questionIndex + 1} / {questions.length}
          </span>
        </div>

        {/* Audio button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <button
            onClick={playAudio}
            disabled={isPlaying || !audioReady}
            className={audioReady && !isPlaying ? 'lc-audio-pulse' : ''}
            style={{
              width: 92, height: 92, borderRadius: '50%',
              background: !audioReady ? '#c8c8c8' : isPlaying ? dark : primary,
              border: '4px solid rgba(255,255,255,0.75)',
              fontSize: 36, cursor: audioReady && !isPlaying ? 'pointer' : 'default',
              outline: 'none', transition: 'background 0.2s',
            }}
          >
            {!audioReady ? '⏳' : isPlaying ? '⏸' : '🔊'}
          </button>

          {/* Tap hint — only visible when idle */}
          {audioReady && !isPlaying && (
            <div className="lc-tap-hint" style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: primary, color: '#ffffff',
              fontSize: 12, fontWeight: 800,
              padding: '4px 14px', borderRadius: 50,
              boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
              letterSpacing: '0.02em',
            }}>
              Press to listen again!
            </div>
          )}

          <p style={{ color: dark, fontSize: 15, margin: 0, fontWeight: 700 }}>
            Listen and choose the correct word
          </p>
        </div>

        {/* 2×2 answer cards */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 14, width: '100%', maxWidth: 700, flex: 1,
        }}>
          {question.options.map((opt, i) => {
            const { bg, border, color, shadow, labelColor, extraClass } = getCardProps(i)

            return (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                className={`lc-card ${extraClass}`}
                data-locked={locked ? 'true' : 'false'}
                style={{
                  background: bg, border, borderRadius: 22,
                  color, fontSize: 18, fontWeight: 700,
                  fontFamily: 'Nunito, sans-serif',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 8, boxShadow: shadow, outline: 'none',
                  cursor: locked ? 'default' : 'pointer',
                }}
              >
                <span>{opt}</span>
                <span style={{ fontSize: 10, color: labelColor, fontWeight: 800, letterSpacing: '0.12em' }}>
                  {['A', 'B', 'C', 'D'][i]}
                </span>
              </button>
            )
          })}
        </div>

      </div>
    </div>
  )
}
