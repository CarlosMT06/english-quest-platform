import { useState, useEffect } from 'react'

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

export default function ListenChooseUI({ unitData, playerName, score, onScoreChange }) {
  const vocabulary = unitData.vocabulary
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
  const [attempts, setAttempts]           = useState(3)
  const [selected, setSelected]           = useState(null)
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

    if (isCorrect) {
      onScoreChange(prev => prev + 50)
      setTimeout(() => {
        if (questionIndex < questions.length - 1) {
          setQuestionIndex(prev => prev + 1)
          setSelected(null)
          setAttempts(3)
        } else {
          setFinished(true)
        }
      }, 1300)
    } else {
      setAttempts(prev => prev - 1)
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
      bg: '#ffffff', border: '2.5px solid #7BC67E', color: '#2D3436',
      shadow: '0 4px 14px rgba(0,0,0,0.07)', labelColor: '#aac8aa',
      extraClass: '',
    }
  }

  if (finished) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#F7F6F2', gap: 18, fontFamily: 'Nunito',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(76,171,77,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 20, left: -80, width: 260, height: 260, borderRadius: '50%', background: 'rgba(63,224,208,0.07)', pointerEvents: 'none' }} />
        <div style={{ fontSize: 72, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.12))' }}>🏆</div>
        <div style={{ color: '#2D3436', fontSize: 28, fontWeight: 800 }}>Great job, {playerName}!</div>
        <div style={{
          color: '#ffffff', fontSize: 18, fontWeight: 800,
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
      background: '#F7F6F2', padding: '20px 48px 28px',
      fontFamily: 'Nunito', gap: 16, position: 'relative', overflow: 'hidden',
    }}>

      {/* Decorative blobs */}
      <div style={{ position: 'absolute', top: -55, right: -55, width: 210, height: 210, borderRadius: '50%', background: 'rgba(76,171,77,0.07)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', bottom: 30, left: -75, width: 250, height: 250, borderRadius: '50%', background: 'rgba(63,224,208,0.06)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', top: '42%', right: 24, width: 100, height: 100, borderRadius: '50%', background: 'rgba(244,162,97,0.07)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, flex: 1 }}>

        {/* Progress + lives */}
        <div style={{ width: '100%', maxWidth: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{
            color: '#ffffff', fontSize: 13, fontWeight: 800,
            background: '#4CAB4D', padding: '5px 18px', borderRadius: 50,
            boxShadow: '0 3px 10px rgba(76,171,77,0.35)', letterSpacing: '0.03em',
          }}>
            {questionIndex + 1} / {questions.length}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[...Array(3)].map((_, i) => (
              <span key={i} style={{
                fontSize: 26,
                opacity: i < attempts ? 1 : 0.22,
                filter: i < attempts ? 'drop-shadow(0 2px 5px rgba(250,128,113,0.55))' : 'none',
                transition: 'opacity 0.3s ease, filter 0.3s ease',
              }}>❤️</span>
            ))}
          </div>
        </div>

        {/* Audio button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <button
            onClick={playAudio}
            disabled={isPlaying || !audioReady}
            className={audioReady && !isPlaying ? 'lc-audio-pulse' : ''}
            style={{
              width: 92, height: 92, borderRadius: '50%',
              background: !audioReady ? '#c8c8c8' : isPlaying ? '#e8956a' : '#F4A261',
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
              background: '#4CAB4D', color: '#ffffff',
              fontSize: 12, fontWeight: 800,
              padding: '4px 14px', borderRadius: 50,
              boxShadow: '0 2px 8px rgba(76,171,77,0.3)',
              letterSpacing: '0.02em',
            }}>
              Press to listen again!
            </div>
          )}

          <p style={{ color: '#2D3436', fontSize: 15, margin: 0, fontWeight: 700 }}>
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
