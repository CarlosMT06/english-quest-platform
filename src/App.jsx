import { useEffect, useState } from 'react'
import * as Phaser from 'phaser'
import { StartScene } from './game/scenes/StartScene'
import { GameScene  } from './game/scenes/GameScene'
import ListenChooseUI from './components/minigames/ListenChooseUI'
import ListenImageUI  from './components/minigames/ListenImageUI'
import ListenPointOverlay from './components/minigames/ListenPointOverlay'
import HangmanUI      from './components/minigames/HangmanUI'
import MinigameSelect from './components/MinigameSelect'
import { getPalette } from './theme/palettes'
import { playSfx } from './utils/sfx'
import unit4 from './content/grade4/unit4.json'

const WORLD_W = 1280

export default function App() {
  const [screen, setScreen]               = useState('start')
  const [playerName, setPlayerName]       = useState('')
  const [score, setScore]                 = useState(0)
  const [activeMinigame, setActiveMinigame] = useState(null)
  const [worldMinigame, setWorldMinigame]   = useState(null)
  const [showHelp, setShowHelp]             = useState(false)

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
    if (screen !== 'world') return

    const config = {
      type: Phaser.AUTO,
      width: 960,
      height: 640,
      parent: 'world-phaser',
      pixelArt: true,
      physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false },
      },
      scale: {
        mode: Phaser.Scale.RESIZE,
      },
      scene: [GameScene],
    }

    const game = new Phaser.Game(config)
    return () => game.destroy(true)
  }, [screen])

  // El mundo (Phaser) dispara este evento para lanzar un minijuego incrustado
  useEffect(() => {
    if (screen !== 'world') return
    const onStart = (e) => setWorldMinigame(e.detail?.id ?? null)
    window.addEventListener('start-minigame', onStart)
    return () => window.removeEventListener('start-minigame', onStart)
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
            Find the Treasure!
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

            {/* Input de nombre (ancho completo) */}
            <input
              placeholder="Your name..."
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && playerName.trim() && setScreen('world')}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: '1px solid rgba(217,119,6,0.4)',
                background: 'rgba(255,255,255,0.08)',
                color: '#fff', fontSize: 15,
                fontFamily: 'Nunito', outline: 'none',
                textAlign: 'center', boxSizing: 'border-box',
              }}
            />

            {/* Botón principal → juego principal (mundo) */}
            <button
              onClick={() => { playSfx('click'); if (playerName.trim()) setScreen('world') }}
              style={{
                background: '#d97706', border: 'none', borderRadius: 13,
                padding: '13px 0', fontSize: 16, color: '#fff',
                fontFamily: 'Nunito', cursor: 'pointer', width: '100%',
                fontWeight: 500, letterSpacing: '0.02em',
                boxShadow: '0 4px 12px rgba(180,83,9,0.4)'
              }}>
              Begin the Journey!
            </button>

            {/* Botón secundario → jugar solo los minijuegos */}
            <button
              onClick={() => { playSfx('click'); setScreen('select') }}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1.5px solid rgba(217,119,6,0.6)',
                borderRadius: 12, padding: '11px 0', fontSize: 14,
                color: '#fde68a', fontWeight: 600,
                fontFamily: 'Nunito', cursor: 'pointer', width: '100%',
                letterSpacing: '0.02em',
              }}>
              Play Minigames Only
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

  // ── Mundo principal (platformer) ────────────────────────
  if (screen === 'world') {
    return (
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#1a1a1a' }}>
        <div id="world-phaser" style={{ position: 'absolute', inset: 0 }} />
        {worldMinigame === 'listen-image' && (
          <ListenPointOverlay
            unitData={unit4}
            onEnd={() => {
              setWorldMinigame(null)
              window.dispatchEvent(new CustomEvent('minigame-ended'))
            }}
          />
        )}
      </div>
    )
  }

  // ── Pantalla de selección de minijuego ──────────────────
  if (screen === 'select') {
    return (
      <MinigameSelect
        playerName={playerName}
        onBack={() => setScreen('start')}
        onSelect={id => { setActiveMinigame(id); setScore(0); setScreen('game') }}
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
        <button onClick={() => { playSfx('click'); setScreen('start'); setScore(0) }}
          style={{ background: '#d97706', border: 'none', borderRadius: 12,
                   padding: '12px 40px', fontSize: 16, color: '#fff',
                   fontFamily: 'Nunito', cursor: 'pointer', marginTop: 8 }}>
          Play Again
        </button>
      </div>
    )
  }

  // ── Pantalla del juego ───────────────────────────────────
  const palette = getPalette(activeMinigame)

  const hudBtnStyle = {
    width: 44, height: 44, borderRadius: 12,
    background: 'rgba(255,255,255,0.2)',
    border: '1.5px solid rgba(255,255,255,0.4)',
    color: '#ffffff', fontSize: 22, fontWeight: 800,
    cursor: 'pointer', lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Nunito', flexShrink: 0,
  }

  return (
    <div style={{ background: palette.bg, height: '100vh',
                  display: 'flex', flexDirection: 'column',
                  overflow: 'hidden' }}>

      {/* HUD — botones + título centrado */}
      <div style={{ background: palette.primary,
                    padding: '14px 20px', display: 'flex',
                    justifyContent: 'space-between', alignItems: 'center',
                    boxShadow: '0 3px 12px rgba(0,0,0,0.15)' }}>

        {/* Izquierda: volver */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
          <button
            onClick={() => { playSfx('click'); setScreen('select') }}
            title="Back"
            style={hudBtnStyle}
          >←</button>
        </div>

        {/* Centro: título */}
        <span style={{ color: '#ffffff', fontFamily: 'Nunito', fontSize: 22, fontWeight: 800,
                       letterSpacing: '0.02em', flexShrink: 0 }}>
          {activeMinigame === 'listen-choose' && 'Listen & Choose'}
          {activeMinigame === 'listen-image'  && 'Listen & Point'}
          {activeMinigame === 'memory-match'  && 'Memory Match'}
          {activeMinigame === 'true-false'    && 'True or False'}
          {activeMinigame === 'hangman'       && 'Hangman'}
          {activeMinigame === 'fill-blank'    && 'Fill the Blank'}
        </span>

        {/* Derecha: instrucciones */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={() => { playSfx('click'); setShowHelp(true) }}
            title="Instructions"
            style={hudBtnStyle}
          >?</button>
        </div>
      </div>

      {activeMinigame === 'listen-choose' && (
        <ListenChooseUI
          unitData={unit4}
          playerName={playerName}
          score={score}
          onScoreChange={setScore}
          palette={palette}
        />
      )}
      {activeMinigame === 'listen-image' && (
        <ListenImageUI
          unitData={unit4}
          playerName={playerName}
          score={score}
          onScoreChange={setScore}
          palette={palette}
        />
      )}
      {activeMinigame === 'hangman' && (
        <HangmanUI
          unitData={unit4}
          playerName={playerName}
          score={score}
          onScoreChange={setScore}
          palette={palette}
        />
      )}

      {/* Recuadro de instrucciones */}
      {showHelp && (
        <div
          onClick={() => setShowHelp(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 20,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Nunito',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#ffffff', borderRadius: 20,
              width: 'min(90vw, 520px)', maxHeight: '80vh',
              boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            {/* Encabezado */}
            <div style={{
              background: palette.primary, color: '#ffffff',
              padding: '16px 22px', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 20, fontWeight: 800 }}>Instructions</span>
              <button
                onClick={() => { playSfx('click'); setShowHelp(false) }}
                title="Close"
                style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: 'rgba(255,255,255,0.25)',
                  border: '1.5px solid rgba(255,255,255,0.4)',
                  color: '#ffffff', fontSize: 18, fontWeight: 800,
                  cursor: 'pointer', lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >×</button>
            </div>

            {/* Contenido (vacío por ahora — espacio para las instrucciones) */}
            <div style={{
              padding: '24px 22px', minHeight: 180,
              color: '#9aa0a6', fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center',
            }}>
              (Las instrucciones irán aquí)
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
