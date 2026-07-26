import { useEffect, useRef, useState } from 'react'
import * as Phaser from 'phaser'
import { StartScene } from './game/scenes/StartScene'
import { GameScene  } from './game/scenes/GameScene'
import { MapTestScene } from './game/scenes/MapTestScene'
import ListenChooseUI from './components/minigames/ListenChooseUI'
import ListenImageUI  from './components/minigames/ListenImageUI'
import ListenPointOverlay from './components/minigames/ListenPointOverlay'
import HangmanUI      from './components/minigames/HangmanUI'
import FillBlankUI    from './components/minigames/FillBlankUI'
import MemoryMatchUI  from './components/minigames/MemoryMatchUI'
import TrueFalseUI    from './components/minigames/TrueFalseUI'
import MinigameSelect from './components/MinigameSelect'
import { getPalette } from './theme/palettes'
import { INSTRUCTIONS } from './content/instructions'
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
  const [nameError, setNameError]           = useState(false)
  const [showAbout, setShowAbout]           = useState(false)
  // Posición de retorno del jugador en la ciudad (al volver de un interior).
  const [cityReturn, setCityReturn]         = useState(null)
  // Overlay de fundido a negro para transiciones ciudad ↔ interior.
  const [fading, setFading]                 = useState(false)

  // Música de fondo en loop (volumen bajo). Vive fuera de Phaser para no
  // cortarse al cambiar de escena. NO suena en la pantalla de inicio (esa
  // tiene su propia música en StartScene) ni en el interior del hospital.
  const musicRef = useRef(null)
  useEffect(() => {
    const music = new Audio('/assets/sfx/music.mp3')
    music.loop = true
    music.volume = 0.12
    musicRef.current = music
    return () => music.pause()
  }, [])

  // Reproduce la música solo fuera del inicio y del interior.
  useEffect(() => {
    const music = musicRef.current
    if (!music) return
    const silent = screen === 'start' || screen === 'world'
    if (silent) music.pause()
    else music.play().catch(() => {})
  }, [screen])

  // Intenta ir a la ciudad; si no hay nombre, muestra un aviso breve.
  function tryBeginJourney() {
    if (playerName.trim()) {
      setScreen('maptest')
    } else {
      setNameError(true)
      setTimeout(() => setNameError(false), 2200)
    }
  }

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

  // Escena de prueba del mapa de Tiled (cámara libre)
  useEffect(() => {
    if (screen !== 'maptest') return

    const config = {
      type: Phaser.AUTO,
      width: 960,
      height: 640,
      parent: 'maptest-phaser',
      pixelArt: true,
      physics: {
        default: 'matter',
        matter: { gravity: { x: 0, y: 0 }, debug: false },
      },
      scale: { mode: Phaser.Scale.RESIZE },
      scene: [MapTestScene],
    }

    const game = new Phaser.Game(config)
    // Arranca la escena con la posición de retorno (si venimos de un interior)
    game.scene.start('MapTestScene', cityReturn ? { spawn: cityReturn } : undefined)
    return () => game.destroy(true)
  }, [screen])

  // Cambia de pantalla con un fundido a negro (para transiciones de escenario).
  function fadeToScreen(next) {
    setFading(true)
    setTimeout(() => {
      setScreen(next)
      // Deja el overlay negro un instante y luego lo desvanece
      setTimeout(() => setFading(false), 80)
    }, 460)
  }

  // Ciudad → interior: al pisar una puerta (trigger) se cambia de escenario.
  useEffect(() => {
    if (screen !== 'maptest') return
    const onEnter = (e) => {
      const { target, returnX, returnY } = e.detail ?? {}
      // Guarda dónde reaparecer en la ciudad al volver
      if (returnX != null) setCityReturn({ x: returnX, y: returnY })
      // Router de destinos: por ahora "hospital" abre el interior (GameScene)
      if (target === 'hospital') fadeToScreen('world')
    }
    window.addEventListener('enter-interior', onEnter)
    return () => window.removeEventListener('enter-interior', onEnter)
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

        {/* Botón "About" (esquina superior derecha) */}
        <button
          onClick={() => { playSfx('click'); setShowAbout(true) }}
          style={{
            position: 'absolute', top: 16, right: 16, zIndex: 3,
            background: 'rgba(255,255,255,0.75)',
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
            border: '1px solid rgba(47,120,200,0.6)',
            borderRadius: 14, padding: '10px 20px',
            color: '#173A5E', fontSize: 14, fontWeight: 700,
            fontFamily: 'Nunito', cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            About
        </button>

        {/* Modal "About" */}
        {showAbout && (
          <div
            onClick={() => setShowAbout(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 60,
              background: 'rgba(10,25,45,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 24, animation: 'help-fade 0.2s ease',
            }}>
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'relative',
                background: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid rgba(47,120,200,0.4)',
                borderRadius: 22, padding: '30px 36px',
                width: '100%', maxWidth: 520,
                boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
                fontFamily: 'Nunito',
                animation: 'help-pop 0.25s ease',
              }}>
              {/* Cerrar */}
              <button
                onClick={() => { playSfx('click'); setShowAbout(false) }}
                style={{
                  position: 'absolute', top: 14, right: 16,
                  background: 'transparent', border: 'none',
                  color: '#173A5E', fontSize: 24, fontWeight: 700,
                  cursor: 'pointer', lineHeight: 1,
                }}>
                ×
              </button>

              <h2 style={{
                color: '#173A5E', fontSize: 26, fontWeight: 800,
                margin: '0 0 16px', textAlign: 'center',
              }}>
                About
              </h2>

              {/* Contenido: rellenar más adelante */}
              <p style={{
                color: '#2b3a4a', fontSize: 15, lineHeight: 1.6,
                margin: 0, textAlign: 'center',
              }}>
                {/* TODO: agregar aquí la información del proyecto */}
                Information coming soon.
              </p>
            </div>
          </div>
        )}

        {/* Aviso flotante: falta escribir el nombre (fuera del menú, centrado) */}
        {nameError && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            paddingTop: 600,   // ← subí/bajá este número para mover el aviso verticalmente
            pointerEvents: 'none',
          }}>
            <div style={{
              background: 'rgba(255,255,255,0.6)',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(47,120,200,0.6)',
              borderRadius: 20, padding: '18px 30px',
              color: '#173A5E', fontSize: 16, fontWeight: 700,
              fontFamily: 'Nunito', textAlign: 'center',
              boxShadow: '0 10px 40px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.06)',
              animation: 'name-warn 2.2s ease forwards',
              whiteSpace: 'nowrap',
            }}>
              ✏️ Please enter your name first
            </div>
          </div>
        )}

        {/* Logos institucionales (juntos, esquina superior izquierda) */}
        <div style={{
          position: 'absolute', top: 16, left: 16, zIndex: 3,
          background: 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          borderRadius: 14, padding: '8px 14px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <img src="/assets/logos/logo1.png" alt="" style={{ height: 50, display: 'block' }} />
          <div style={{ width: 1, height: 34, background: 'rgba(0,0,0,0.12)' }} />
          <img src="/assets/logos/logo2.png" alt="" style={{ height: 50, display: 'block' }} />
        </div>

        {/* Contenido encima del fondo */}
        <div style={{ position: 'relative', zIndex: 2,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: 20 }}>

          {/* Unit tag */}
          <div style={{
            background: 'rgba(255,255,255,0.6)',
            border: '1px solid rgba(47,120,200,0.6)',
            color: '#2F78C8', fontSize: 11, fontWeight: 700,
            padding: '3px 14px', borderRadius: 20,
            fontFamily: 'Nunito'
          }}>
            Grade 4 · Unit 4 · Take Care
          </div>

          {/* Tarjeta 1: título + subtítulo */}
          <div style={{
            background: 'rgba(255,255,255,0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderRadius: 20, padding: '16px 34px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.06)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 6,
          }}>
            {/* Logo */}
            <h1 style={{
              color: '#173A5E', fontFamily: 'Nunito', fontSize: 52,
              fontWeight: 700, letterSpacing: '-0.5px',
              textShadow: '0 1px 2px rgba(0,0,0,0.12)'
            }}>
              English<span style={{ color: '#2F78C8' }}>Quest</span>
            </h1>

            {/* Subtítulo */}
            <p style={{
              color: '#2F78C8', fontFamily: 'Nunito',
              fontSize: 12, letterSpacing: '0.14em',
              textTransform: 'uppercase',
              textShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }}>
              Find the Treasure!
            </p>
          </div>

          {/* Tarjeta 2: nombre + botones */}
          <div style={{
            background: 'rgba(255,255,255,0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderRadius: 20, padding: '22px 30px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.06)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 14, width: 300
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: '#2F78C8',
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
              onKeyDown={e => { if (e.key === 'Enter') tryBeginJourney() }}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: '1px solid rgba(47,120,200,0.5)',
                background: 'rgba(255,255,255,0.55)',
                color: '#173A5E', fontSize: 15,
                fontFamily: 'Nunito', outline: 'none',
                textAlign: 'center', boxSizing: 'border-box',
              }}
            />

            {/* Botón principal → juego principal (mundo) */}
            <button
              onClick={() => { playSfx('click'); tryBeginJourney() }}
              style={{
                background: '#2F78C8', border: 'none', borderRadius: 13,
                padding: '13px 0', fontSize: 16, color: '#fff',
                fontFamily: 'Nunito', cursor: 'pointer', width: '100%',
                fontWeight: 500, letterSpacing: '0.02em',
                boxShadow: '0 4px 12px rgba(23,58,94,0.45)'
              }}>
              Begin the Journey!
            </button>

            {/* Botón secundario → jugar solo los minijuegos */}
            <button
              onClick={() => { playSfx('click'); setScreen('select') }}
              style={{
                background: 'rgba(47,120,200,0.12)',
                border: '1.5px solid rgba(47,120,200,0.7)',
                borderRadius: 12, padding: '11px 0', fontSize: 14,
                color: '#2F78C8', fontWeight: 700,
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
                background: 'rgba(255,255,255,0.85)',
                border: '1px solid rgba(47,120,200,0.3)',
                borderRadius: 20, padding: '4px 12px',
                fontSize: 11, color: '#173A5E',
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
        {/* Salir del interior → volver a la ciudad en la posición guardada.
            Solo aparece si entramos desde la ciudad (hay retorno guardado). */}
        {cityReturn && (
          <button
            onClick={() => fadeToScreen('maptest')}
            style={{
              position: 'fixed', top: 12, left: 12, zIndex: 100,
              background: 'rgba(0,0,0,0.7)', color: '#fff',
              border: '1px solid rgba(255,255,255,0.4)', borderRadius: 8,
              padding: '8px 16px', fontFamily: 'Nunito', fontSize: 14,
              fontWeight: 700, cursor: 'pointer',
            }}>
            ← Back to the City
          </button>
        )}
        <FadeOverlay show={fading} />
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

  // ── Escena de prueba del mapa (temporal) ────────────────
  if (screen === 'maptest') {
    return (
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#1a1a1a' }}>
        <div id="maptest-phaser" style={{ position: 'absolute', inset: 0 }} />
        <button
          onClick={() => setScreen('start')}
          style={{
            position: 'fixed', top: 12, right: 12, zIndex: 100,
            background: 'rgba(0,0,0,0.7)', color: '#fff',
            border: '1px solid rgba(255,255,255,0.4)', borderRadius: 8,
            padding: '8px 16px', fontFamily: 'monospace', fontSize: 13,
            cursor: 'pointer',
          }}>
          ← Back
        </button>
        <FadeOverlay show={fading} />
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
      {activeMinigame === 'fill-blank' && (
        <FillBlankUI
          unitData={unit4}
          score={score}
          onScoreChange={setScore}
          palette={palette}
        />
      )}
      {activeMinigame === 'memory-match' && (
        <MemoryMatchUI
          unitData={unit4}
          score={score}
          onScoreChange={setScore}
          palette={palette}
        />
      )}
      {activeMinigame === 'true-false' && (
        <TrueFalseUI
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
            animation: 'help-fade 0.2s ease',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#ffffff', borderRadius: 20,
              width: 'min(92vw, 560px)', maxHeight: '82vh',
              boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              animation: 'help-pop 0.28s cubic-bezier(0.34, 1.3, 0.7, 1)',
            }}
          >
            {/* Encabezado */}
            <div style={{
              background: palette.primary, color: '#ffffff',
              padding: '16px 22px', display: 'flex',
              justifyContent: 'center', alignItems: 'center',
              position: 'relative',
            }}>
              <span style={{ fontSize: 20, fontWeight: 800 }}>Instructions</span>
              <button
                onClick={() => { playSfx('click'); setShowHelp(false) }}
                title="Close"
                style={{
                  position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)',
                  width: 34, height: 34, borderRadius: 10,
                  background: 'rgba(255,255,255,0.25)',
                  border: '1.5px solid rgba(255,255,255,0.4)',
                  color: '#ffffff', fontSize: 18, fontWeight: 800,
                  cursor: 'pointer', lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >×</button>
            </div>

            {/* Contenido: instrucciones en inglés y luego en español */}
            <div style={{
              padding: '24px 26px', overflowY: 'auto',
              color: '#2D3436', fontSize: 17, lineHeight: 1.45,
              display: 'flex', flexDirection: 'column', gap: 22,
            }}>
              {['en', 'es'].map((lang, li) => (
                <div key={lang}>
                  {li === 1 && <div style={{ height: 1, background: '#e5e7eb', margin: '0 0 22px' }} />}
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em',
                                textTransform: 'uppercase', color: palette.primary, marginBottom: 12,
                                textAlign: 'center' }}>
                    {lang === 'en' ? 'English' : 'Español'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                    {INSTRUCTIONS[activeMinigame]?.[lang].map((step, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: 12, alignItems: 'flex-start',
                        animation: `help-item 0.32s ease ${i * 0.05}s both`,
                      }}>
                        <span style={{
                          flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
                          background: palette.primary, color: '#fff',
                          fontSize: 15, fontWeight: 800,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>{i + 1}</span>
                        <span style={{ flex: 1, paddingTop: 3 }}>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// Overlay de fundido a negro para transiciones entre escenarios.
function FadeOverlay({ show }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: '#000',
      opacity: show ? 1 : 0,
      transition: 'opacity 0.46s ease',
      pointerEvents: show ? 'auto' : 'none',
    }} />
  )
}
