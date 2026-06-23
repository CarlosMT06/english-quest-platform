import { useEffect, useState } from 'react'
import * as Phaser from 'phaser'
import { StartScene } from './game/scenes/StartScene'
import ListenChooseUI from './components/minigames/ListenChooseUI'
import ListenImageUI  from './components/minigames/ListenImageUI'
import MinigameSelect from './components/MinigameSelect'
import unit4 from './content/grade4/unit4.json'

export default function App() {
  const [screen, setScreen]               = useState('start')
  const [playerName, setPlayerName]       = useState('')
  const [score, setScore]                 = useState(0)
  const [activeMinigame, setActiveMinigame] = useState(null)

  useEffect(() => {
    if (screen !== 'start') return

    const config = {
      type: Phaser.AUTO,
      width: 1280,
      height: 720,
      parent: 'start-phaser',
      pixelArt: true,
      scale: {
        mode: Phaser.Scale.ENVELOP,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      scene: [StartScene]
    }

    const game = new Phaser.Game(config)
    return () => game.destroy(true)
  }, [screen])

  useEffect(() => {
    if (screen !== 'game') return
    const onComplete = () => setScreen('complete')
    window.addEventListener('minigame-complete', onComplete)
    return () => window.removeEventListener('minigame-complete', onComplete)
  }, [screen])

  // ── Pantalla de inicio ───────────────────────────────────
  if (screen === 'start') {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div
          id="start-phaser"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0
          }}
        />

        {/* Overlay oscuro al 22% */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.22)',
          zIndex: 1
        }} />

        {/* Contenido encima del fondo */}
        <div style={{ position: 'relative', zIndex: 2,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: 20 }}>

          {/* Unit tag */}
          <div style={{
            background: 'rgba(120,53,15,0.75)',
            border: '1px solid rgba(217,119,6,0.5)',
            color: '#fde68a', fontSize: 11, fontWeight: 500,
            padding: '3px 14px', borderRadius: 20,
            fontFamily: 'Nunito'
          }}>
            Unit 4 · Take Care
          </div>

          {/* Logo */}
          <h1 style={{
            color: '#fff', fontFamily: 'Nunito', fontSize: 52,
            fontWeight: 500, letterSpacing: '-0.5px',
            textShadow: '0 2px 12px rgba(0,0,0,0.7)'
          }}>
            English<span style={{ color: '#d97706' }}>Quest</span>
          </h1>

          {/* Subtítulo */}
          <p style={{
            color: '#fde68a', fontFamily: 'Nunito',
            fontSize: 12, letterSpacing: '0.14em',
            textTransform: 'uppercase',
            textShadow: '0 1px 6px rgba(0,0,0,0.8)'
          }}>
            Reach the top!
          </p>

          {/* Panel */}
          <div style={{
            background: 'rgba(20,12,5,0.72)',
            border: '1px solid rgba(217,119,6,0.35)',
            borderRadius: 20, padding: '22px 30px',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 14, width: 300
          }}>
            <div style={{
              fontSize: 11, fontWeight: 500, color: '#fbbf24',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              fontFamily: 'Nunito'
            }}>
              Enter your name
            </div>

            {/* Input con avatar */}
            <div style={{ display: 'flex', alignItems: 'center',
                          gap: 8, width: '100%' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: '#78350f', border: '2px solid #d97706',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 16, flexShrink: 0
              }}>
                ⚔️
              </div>
              <input
                placeholder="Your name..."
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && playerName.trim() && setScreen('select')}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 10,
                  border: '1px solid rgba(217,119,6,0.4)',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff', fontSize: 15,
                  fontFamily: 'Nunito', outline: 'none',
                  textAlign: 'center'
                }}
              />
            </div>

            {/* Botón */}
            <button
              onClick={() => { if (playerName.trim()) setScreen('select') }}
              style={{
                background: '#d97706', border: 'none', borderRadius: 13,
                padding: '13px 0', fontSize: 16, color: '#fff',
                fontFamily: 'Nunito', cursor: 'pointer', width: '100%',
                fontWeight: 500, letterSpacing: '0.02em',
                boxShadow: '0 4px 12px rgba(180,83,9,0.4)'
              }}>
              ⚔️ Begin the Journey!
            </button>
          </div>

          {/* Pills */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { dot: '#22c55e', text: '6 minigames' },
              { dot: '#f97316', text: 'Single player' },
              { dot: '#38bdf8', text: 'Audio in English' }
            ].map(({ dot, text }) => (
              <div key={text} style={{
                background: 'rgba(20,12,5,0.65)',
                border: '1px solid rgba(217,119,6,0.25)',
                borderRadius: 20, padding: '4px 12px',
                fontSize: 11, color: '#fde68a',
                fontFamily: 'Nunito',
                display: 'flex', alignItems: 'center', gap: 6
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: dot, flexShrink: 0
                }} />
                {text}
              </div>
            ))}
          </div>

        </div>
      </div>
    )
  }

  // ── Pantalla de selección de minijuego ──────────────────
  if (screen === 'select') {
    return (
      <MinigameSelect
        playerName={playerName}
        onBack={() => setScreen('start')}
        onSelect={id => { setActiveMinigame(id); setScreen('game') }}
      />
    )
  }

  // ── Pantalla de resultado final ──────────────────────────
  if (screen === 'complete') {
    return (
      <div style={{ background: '#1a2a1a', height: '100vh',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ fontSize: 64 }}>🏆</div>
        <h2 style={{ color: '#fde68a', fontFamily: 'Nunito', fontSize: 32 }}>
          Well done, {playerName}!
        </h2>
        <p style={{ color: '#fbbf24', fontFamily: 'Nunito', fontSize: 20 }}>
          Score: {score} pts
        </p>
        <button onClick={() => { setScreen('start'); setScore(0) }}
          style={{ background: '#d97706', border: 'none', borderRadius: 12,
                   padding: '12px 40px', fontSize: 16, color: '#fff',
                   fontFamily: 'Nunito', cursor: 'pointer', marginTop: 8 }}>
          Play Again
        </button>
      </div>
    )
  }

  // ── Pantalla del juego ───────────────────────────────────
  return (
    <div style={{ background: '#F7F6F2', height: '100vh',
                  display: 'flex', flexDirection: 'column',
                  overflow: 'hidden' }}>

      {/* HUD */}
      <div style={{ background: '#4CAB4D',
                    padding: '10px 20px', display: 'flex',
                    justifyContent: 'space-between', alignItems: 'center',
                    boxShadow: '0 3px 12px rgba(76,171,77,0.35)' }}>
        <span style={{ color: '#ffffff', fontFamily: 'Nunito', fontSize: 14, fontWeight: 700,
                       background: 'rgba(255,255,255,0.2)',
                       padding: '4px 14px', borderRadius: 50 }}>
          ⚔️ {playerName}
        </span>
        <span style={{ color: '#ffffff', fontFamily: 'Nunito', fontSize: 13, fontWeight: 700,
                       background: 'rgba(255,255,255,0.25)',
                       padding: '4px 16px', borderRadius: 50 }}>
          {activeMinigame === 'listen-choose' && '🎧 Listen & Choose'}
          {activeMinigame === 'listen-image'  && '🖼️ Listen & Point'}
          {activeMinigame === 'memory-match'  && '🃏 Memory Match'}
          {activeMinigame === 'true-false'    && '✅ True or False'}
          {activeMinigame === 'hangman'       && '🔤 Hangman'}
          {activeMinigame === 'fill-blank'    && '✏️ Fill the Blank'}
        </span>
        <span style={{ color: '#ffffff', fontFamily: 'Nunito', fontSize: 14, fontWeight: 800,
                       background: '#F4A261',
                       padding: '4px 14px', borderRadius: 50,
                       boxShadow: '0 2px 8px rgba(244,162,97,0.45)' }}>
          ⭐ {score} pts
        </span>
      </div>

      {activeMinigame === 'listen-choose' && (
        <ListenChooseUI
          unitData={unit4}
          playerName={playerName}
          score={score}
          onScoreChange={setScore}
        />
      )}
      {activeMinigame === 'listen-image' && (
        <ListenImageUI
          unitData={unit4}
          playerName={playerName}
          score={score}
          onScoreChange={setScore}
        />
      )}

    </div>
  )
}
