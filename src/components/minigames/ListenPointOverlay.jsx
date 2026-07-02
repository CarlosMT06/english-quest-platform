import { useState, useEffect } from 'react'

// Versión mínima de "Listen & Point" para incrustar sobre el mundo:
// solo tarjetas + botón de volver a escuchar + vidas, sobre fondo oscuro.
// 3 vidas globales: al agotarlas termina (onEnd('lose')); al completar
// todas las rondas termina (onEnd('win')).

function generateQuestions(items, count) {
  const shuffled = [...items].sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, Math.min(count, items.length))

  return selected.map(correct => {
    const others = items.filter(v => v.id !== correct.id)
    const wrong  = [...others].sort(() => Math.random() - 0.5).slice(0, 3)
    const all    = [...wrong, correct].sort(() => Math.random() - 0.5)
    return {
      id:      correct.id,
      audio:   correct.audio,
      options: all.map(o => ({ id: o.id, image: o.image })),
      correct: all.findIndex(o => o.id === correct.id),
    }
  })
}

export default function ListenPointOverlay({ unitData, onEnd }) {
  const config    = unitData.minigames['listen-image']
  const imgBase   = unitData.paths.images
  const audioBase = unitData.paths.audioImage
  const items     = config.items.map(item => ({
    ...item,
    image: imgBase + item.image,
    audio: item.audio ? audioBase + item.audio : null,
  }))

  const [questions] = useState(() => generateQuestions(items, config.rounds))

  const [audioCache] = useState(() => {
    const cache = {}
    questions.forEach(q => {
      if (!q.audio) return
      const audio = new Audio(q.audio)
      audio.preload = 'auto'
      audio.load()
      cache[q.audio] = audio
    })
    return cache
  })

  const [questionIndex, setQuestionIndex] = useState(0)
  const [lives, setLives]                 = useState(3)
  const [selected, setSelected]           = useState(null)
  const [isPlaying, setIsPlaying]         = useState(false)
  const [audioReady, setAudioReady]       = useState(false)

  const question = questions[questionIndex]
  const locked   = selected !== null
  const hasAudio = !!question.audio

  useEffect(() => {
    if (!hasAudio) return
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
    if (isPlaying || !hasAudio) return
    setIsPlaying(true)
    const audio = audioCache[question.audio]
    audio.currentTime = 0
    audio.onended = () => setIsPlaying(false)
    audio.onerror = () => setIsPlaying(false)
    audio.play()
  }

  function handleAnswer(index) {
    if (locked) return
    setSelected(index)
    const isCorrect = index === question.correct

    if (isCorrect) {
      setTimeout(() => {
        if (questionIndex < questions.length - 1) {
          setQuestionIndex(prev => prev + 1)
          setSelected(null)
        } else {
          onEnd('win')
        }
      }, 1000)
    } else {
      const next = lives - 1
      setLives(next)
      setTimeout(() => {
        if (next <= 0) onEnd('lose')
        else setSelected(null)
      }, 1000)
    }
  }

  function getCardProps(index) {
    const isSelected = selected === index
    const isCorrect  = index === question.correct

    if (isSelected && isCorrect) return {
      border: '4px solid #4CAB4D', shadow: '0 8px 24px rgba(76,171,77,0.5)',
      overlay: 'rgba(76,171,77,0.18)', extraClass: 'lc-pop',
    }
    if (isSelected && !isCorrect) return {
      border: '4px solid #FA8071', shadow: '0 8px 24px rgba(250,128,113,0.45)',
      overlay: 'rgba(250,128,113,0.18)', extraClass: 'lc-shake',
    }
    return {
      border: '3px solid #7BC67E', shadow: '0 4px 14px rgba(0,0,0,0.15)',
      overlay: 'transparent', extraClass: '',
    }
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10,
      background: 'rgba(0,0,0,0.72)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 24, fontFamily: 'Nunito',
    }}>

      {/* Vidas */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[...Array(3)].map((_, i) => (
          <span key={i} style={{
            fontSize: 34,
            opacity: i < lives ? 1 : 0.22,
            filter: i < lives ? 'drop-shadow(0 2px 6px rgba(250,128,113,0.6))' : 'none',
            transition: 'opacity 0.3s ease',
          }}>❤️</span>
        ))}
      </div>

      {/* Botón de audio */}
      <button
        onClick={playAudio}
        disabled={isPlaying || !hasAudio || !audioReady}
        className={hasAudio && audioReady && !isPlaying ? 'lc-audio-pulse' : ''}
        style={{
          width: 92, height: 92, borderRadius: '50%',
          background: !hasAudio || !audioReady ? '#c8c8c8' : isPlaying ? '#e8956a' : '#F4A261',
          border: '4px solid rgba(255,255,255,0.85)',
          fontSize: 36, cursor: hasAudio && audioReady && !isPlaying ? 'pointer' : 'default',
          outline: 'none', transition: 'background 0.2s',
        }}
      >
        {!hasAudio ? '🔇' : !audioReady ? '⏳' : isPlaying ? '⏸' : '🔊'}
      </button>

      {/* Tarjetas 1×4 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        width: 'min(92vw, 880px)',
      }}>
        {question.options.map((opt, i) => {
          const { border, shadow, overlay, extraClass } = getCardProps(i)
          return (
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              className={`lc-card ${extraClass}`}
              data-locked={locked ? 'true' : 'false'}
              style={{
                background: '#ffffff',
                border, borderRadius: 22,
                boxShadow: shadow, outline: 'none',
                cursor: locked ? 'default' : 'pointer',
                position: 'relative', overflow: 'hidden',
                padding: 10, aspectRatio: '1 / 1',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <div style={{ position: 'absolute', inset: 0, background: overlay, borderRadius: 18, pointerEvents: 'none' }} />
              <img
                src={opt.image}
                alt=""
                style={{ width: '100%', flex: 1, objectFit: 'contain', minHeight: 0 }}
              />
              <span style={{ fontSize: 11, color: '#aac8aa', fontWeight: 800, letterSpacing: '0.12em' }}>
                {['A', 'B', 'C', 'D'][i]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
