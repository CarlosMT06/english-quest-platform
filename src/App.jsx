import { useEffect, useRef, useState } from 'react'
import * as Phaser from 'phaser'
import { StartScene } from './game/scenes/StartScene'
// GameScene: versión anterior del interior. Ya no se monta, pero se CONSERVA
// (contiene NPC/diálogo/minijuego pendientes de reintegrar). No quitar.
import { GameScene  } from './game/scenes/GameScene'
import { MapTestScene } from './game/scenes/MapTestScene'
import { InteriorHospitalScene } from './game/scenes/InteriorHospitalScene'
import ListenChooseUI from './components/minigames/ListenChooseUI'
import ListenImageUI  from './components/minigames/ListenImageUI'
import ListenPointOverlay from './components/minigames/ListenPointOverlay'
import HangmanUI      from './components/minigames/HangmanUI'
import FillBlankUI    from './components/minigames/FillBlankUI'
import MemoryMatchUI  from './components/minigames/MemoryMatchUI'
import TrueFalseUI    from './components/minigames/TrueFalseUI'
import MinigameSelect from './components/MinigameSelect'
import Celebration from './components/Celebration'
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
  // Textos de las cartulinas del minijuego, como overlay HTML nítido.
  const [stationLabels, setStationLabels]   = useState([])
  const [stationImages, setStationImages]   = useState([])
  // Textos de recuadros del HUD (indicación Q, etc.), overlay HTML nítido.
  const [hudTexts, setHudTexts]             = useState([])
  // Recuadro de confirmación Yes/No (texto + botones clickeables), o null.
  const [confirmData, setConfirmData]       = useState(null)
  // Celebración de victoria del minijuego espacial (confetti a pantalla).
  const [celebrating, setCelebrating]       = useState(false)
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
        default: 'matter',
        matter: { gravity: { x: 0, y: 0 }, debug: false },
      },
      scale: {
        mode: Phaser.Scale.RESIZE,
      },
      scene: [InteriorHospitalScene],
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

  // Transiciones entre escenarios al pisar un trigger (ciudad ↔ interior).
  useEffect(() => {
    if (screen !== 'maptest' && screen !== 'world') return
    const onEnter = (e) => {
      const { target, returnX, returnY } = e.detail ?? {}
      // Router de destinos:
      if (target === 'hospital') {
        // Ciudad → interior. Guarda dónde reaparecer al volver.
        if (returnX != null) setCityReturn({ x: returnX, y: returnY })
        fadeToScreen('world')
      } else if (target === 'city' || target === 'exit') {
        // Interior → ciudad (a la posición guardada frente a la puerta).
        fadeToScreen('maptest')
      }
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

  // Textos de cartulinas (overlay HTML nítido) emitidos por la escena.
  useEffect(() => {
    const onLabels = (e) => setStationLabels(e.detail?.labels ?? [])
    window.addEventListener('station-labels', onLabels)
    return () => window.removeEventListener('station-labels', onLabels)
  }, [])

  // Imágenes de cartulinas (Listen & Point) como overlay HTML nítido.
  useEffect(() => {
    const onImages = (e) => setStationImages(e.detail?.images ?? [])
    window.addEventListener('station-images', onImages)
    return () => window.removeEventListener('station-images', onImages)
  }, [])

  // Textos de recuadros del HUD (indicación Q, etc.), overlay HTML nítido.
  useEffect(() => {
    const onHud = (e) => setHudTexts(e.detail?.texts ?? [])
    window.addEventListener('hud-texts', onHud)
    return () => window.removeEventListener('hud-texts', onHud)
  }, [])

  // Recuadro de confirmación Yes/No (texto + botones clickeables).
  useEffect(() => {
    const onConfirm = (e) => setConfirmData(e.detail ?? null)
    window.addEventListener('confirm-box', onConfirm)
    return () => window.removeEventListener('confirm-box', onConfirm)
  }, [])

  // Celebración de victoria del minijuego espacial (confetti + victory).
  useEffect(() => {
    const onCelebrate = () => {
      setCelebrating(true)
      setTimeout(() => setCelebrating(false), 3000)
    }
    window.addEventListener('minigame-celebrate', onCelebrate)
    return () => window.removeEventListener('minigame-celebrate', onCelebrate)
  }, [])

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
        {/* La salida del interior se hace pisando el trigger `target: city`. */}
        <StationLabels labels={stationLabels} />
        <StationImages images={stationImages} />
        <HudTexts texts={hudTexts} />
        <ConfirmBox data={confirmData} />
        <HelpBox />
        <GameIntro />
        <GameResult />
        {celebrating && <Celebration />}
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
        <HelpBox />
        <GameIntro />
        <GameResult />
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

// Textos de las cartulinas del minijuego, como overlay HTML nítido sobre el
// canvas. Cada label trae su posición en pantalla (centro de la cartulina).
function StationLabels({ labels }) {
  if (!labels?.length) return null
  return (
    <>
      {labels.map((l, i) => {
        // Una sola palabra → nowrap (una línea, div ajustado = centrado exacto).
        // Frase con espacio ("Sore throat") → permite 2 líneas por el espacio.
        const multiWord = /\s/.test(l.text ?? '')
        return (
        <div key={i} style={{
          position: 'absolute', left: l.x, top: l.y,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none', zIndex: 20,
          fontFamily: 'Nunito', fontWeight: 700, fontSize: 17,
          color: '#2D2016', textAlign: 'center',
          lineHeight: 1.1, wordBreak: 'keep-all',
          ...(multiWord ? { maxWidth: 88 } : { whiteSpace: 'nowrap' }),
          textShadow: '0 1px 0 rgba(255,255,255,0.4)',
          userSelect: 'none', WebkitUserSelect: 'none', caretColor: 'transparent',
        }}>
          {l.text}
        </div>
        )
      })}
    </>
  )
}

// Imágenes de las cartulinas de Listen & Point como overlay HTML nítido sobre el
// canvas (los sprites de Phaser se pixelan con pixelArt+zoom). Cada imagen trae
// su centro y su tamaño en pantalla (ya escalado por el zoom de la cámara).
function StationImages({ images }) {
  if (!images?.length) return null
  return (
    <>
      {images.map((im, i) => (
        <img key={i} src={im.src} alt="" style={{
          position: 'absolute', left: im.x, top: im.y,
          width: im.size, height: im.size,
          transform: 'translate(-50%, -50%)',
          objectFit: 'contain',
          pointerEvents: 'none', zIndex: 20,
          userSelect: 'none', WebkitUserSelect: 'none',
        }} />
      ))}
    </>
  )
}

// Recuadro de instrucciones del juego espacial. Reutiliza el mismo diseño que
// el modal "?" de los minijuegos full UI (mismas dimensiones y estilo), pero
// autocontenido: escucha el evento `help-box` que dispara el botón "?" del HUD
// en Phaser, con la paleta y las instrucciones de listen-choose.
function HelpBox() {
  const [open, setOpen] = useState(false)
  const [context, setContext] = useState('map')
  const palette = getPalette('listen-choose')
  // Las instrucciones dependen del contexto (minijuego actual o mapa general).
  // Si aún no hay contenido para ese contexto, `steps` queda indefinido.
  const steps = INSTRUCTIONS[context]

  useEffect(() => {
    const onOpen = (e) => {
      setContext(e.detail?.context ?? 'map')
      setOpen(true)
    }
    window.addEventListener('help-box', onOpen)
    return () => window.removeEventListener('help-box', onOpen)
  }, [])

  // Mientras la ayuda está abierta: congela el mundo (help-open) y ciérrala con
  // cualquier tecla — moverse o pulsar algo del juego la descarta. Al cerrar,
  // reanuda el mundo (help-close).
  useEffect(() => {
    if (!open) return
    window.dispatchEvent(new CustomEvent('help-open'))
    const onKey = () => setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.dispatchEvent(new CustomEvent('help-close'))
    }
  }, [open])

  if (!open) return null
  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 40,
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
            onClick={() => { playSfx('click'); setOpen(false) }}
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
          {!steps && (
            <div style={{ textAlign: 'center', color: '#9aa0a6', padding: '20px 0' }}>
              Instructions coming soon.
            </div>
          )}
          {steps && ['en', 'es'].map((lang, li) => (
            <div key={lang}>
              {li === 1 && <div style={{ height: 1, background: '#e5e7eb', margin: '0 0 22px' }} />}
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em',
                            textTransform: 'uppercase', color: palette.primary, marginBottom: 12,
                            textAlign: 'center' }}>
                {lang === 'en' ? 'English' : 'Español'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {steps?.[lang].map((step, i) => (
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
  )
}

// Frase que "dice" main en el bocadillo del recuadro de intro, por idioma.
const INTRO_GREETING = {
  en: "Hi! Here's how to play this game:",
  es: '¡Hola! Así se juega este juego:',
}

// Recuadro de instrucciones que aparece al INICIAR el minijuego (solo la primera
// vez). Layout: cara de main "hablando" a la izquierda con su bocadillo, pasos
// numerados a la derecha, selector English/Español arriba y "Let's go!" abajo.
// El idioma invierte la paleta: EN = encabezado café + tarjeta blanca; ES = al
// revés (tarjeta café + encabezado blanco). Al cerrar arranca el minijuego.
function GameIntro() {
  const [open, setOpen] = useState(false)
  const [lang, setLang] = useState('en')
  const [context, setContext] = useState('listen-choose-spatial')
  const base = getPalette('listen-choose')
  const steps = INSTRUCTIONS[context]?.[lang] ?? []

  useEffect(() => {
    const onOpen = (e) => {
      setContext(e.detail?.context ?? 'listen-choose-spatial')
      setLang('en')
      setOpen(true)
      window.dispatchEvent(new CustomEvent('help-open'))   // congela el mundo
    }
    window.addEventListener('game-intro', onOpen)
    return () => window.removeEventListener('game-intro', onOpen)
  }, [])

  const close = () => {
    playSfx('click')
    setOpen(false)
    window.dispatchEvent(new CustomEvent('help-close'))     // reanuda el mundo
    window.dispatchEvent(new CustomEvent('game-intro-done')) // → arranca el minijuego
  }

  if (!open) return null

  // Paleta invertida por idioma. café = base.primary, blanco = #ffffff.
  const cafe = base.primary, cafeDark = base.dark
  const es = lang === 'es'
  const cardBg   = es ? cafe : '#ffffff'      // fondo de la tarjeta (cuerpo)
  const headBg   = es ? '#ffffff' : cafe      // barra del encabezado
  const headTx   = es ? cafe : '#ffffff'      // texto del encabezado
  const bodyTx   = es ? '#ffffff' : cafeDark  // texto de los pasos
  const numBg    = es ? '#ffffff' : cafe      // círculo del número
  const numTx    = es ? cafe : '#ffffff'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 45,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Nunito', animation: 'help-fade 0.2s ease',
      }}
    >
      <div
        style={{
          background: cardBg, borderRadius: 20,
          width: 'min(94vw, 760px)', maxHeight: '86vh',
          boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          animation: 'help-pop 0.28s cubic-bezier(0.34, 1.3, 0.7, 1)',
          border: es ? `2px solid ${cafe}` : 'none',
        }}
      >
        {/* Selector de idioma (arriba, centrado) */}
        <div style={{
          background: headBg, padding: '14px 22px',
          display: 'flex', justifyContent: 'center', gap: 12,
        }}>
          {['en', 'es'].map((l) => {
            const active = lang === l
            return (
              <button
                key={l}
                onClick={() => { playSfx('click'); setLang(l) }}
                style={{
                  padding: '8px 24px', borderRadius: 999,
                  fontFamily: 'Nunito', fontSize: 15, fontWeight: 800,
                  cursor: 'pointer',
                  background: active ? headTx : 'transparent',
                  color: active ? headBg : headTx,
                  border: `2px solid ${headTx}`,
                  transition: 'all 0.15s ease',
                }}
              >
                {l === 'en' ? 'English' : 'Español'}
              </button>
            )
          })}
        </div>

        {/* Cuerpo: cara + bocadillo a la izquierda, pasos a la derecha */}
        <div style={{
          padding: '22px 24px', overflowY: 'auto',
          display: 'flex', gap: 22, alignItems: 'center',
        }}>
          {/* Izquierda: cara de main hablando (enmarcada) + bocadillo */}
          <div style={{
            flexShrink: 0, width: 150,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
            {/* Marco del rostro (face-frame.png, 128x128, hueco central 64x64).
                Se escala a FRAME px; la cara llena el hueco central (FRAME/2). */}
            {(() => {
              const FRAME = 128            // tamaño del marco en pantalla
              const HOLE = 120             // tamaño de la cara (independiente del marco)
              return (
                <div style={{ position: 'relative', width: FRAME, height: FRAME }}>
                  {/* Marco (fondo). Su hueco central es opaco, así que la cara va encima. */}
                  <img
                    src="/assets/ui/face-frame.png"
                    alt=""
                    style={{
                      position: 'absolute', inset: 0,
                      width: FRAME, height: FRAME,
                      imageRendering: 'pixelated', pointerEvents: 'none',
                    }}
                  />
                  {/* Cara centrada en el hueco, ENCIMA del marco */}
                  <div
                    className="main-face-talk"
                    style={{
                      '--face-size': `${HOLE}px`,
                      position: 'absolute', zIndex: 1,
                      left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                    }}
                  />
                </div>
              )
            })()}
            <div style={{
              position: 'relative',
              background: numBg, color: numTx,
              borderRadius: 12, padding: '10px 14px',
              fontSize: 14, fontWeight: 700, lineHeight: 1.3, textAlign: 'center',
            }}>
              {INTRO_GREETING[lang]}
            </div>
          </div>

          {/* Derecha: título + pasos numerados */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 20, fontWeight: 800, color: bodyTx, marginBottom: 16,
            }}>
              {es ? 'Instrucciones' : 'Instructions'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {steps.map((step, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  color: bodyTx, fontSize: 16, lineHeight: 1.4,
                  animation: `help-item 0.32s ease ${i * 0.05}s both`,
                }}>
                  <span style={{
                    flexShrink: 0, width: 26, height: 26, borderRadius: '50%',
                    background: numBg, color: numTx,
                    fontSize: 14, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{i + 1}</span>
                  <span style={{ flex: 1, paddingTop: 2 }}>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Botón inferior: empezar */}
        <div style={{ padding: '4px 24px 22px', display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={close}
            style={{
              padding: '12px 44px', borderRadius: 14,
              background: es ? '#ffffff' : cafe, color: es ? cafe : '#ffffff',
              border: 'none', fontFamily: 'Nunito', fontSize: 17, fontWeight: 800,
              cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}
          >
            {es ? '¡A jugar!' : "Let's go!"}
          </button>
        </div>
      </div>
    </div>
  )
}

// Textos bilingües del modal de victoria/derrota.
const RESULT_TEXT = {
  win: {
    title:  { en: 'You got the key!',   es: '¡Conseguiste la llave!' },
    sub:    { en: 'Great job — keep going on your adventure.',
              es: '¡Muy bien! Sigue con tu aventura.' },
    button: { en: 'Continue', es: 'Continuar' },
  },
  lose: {
    slam:   { en: 'You lost!', es: '¡Perdiste!' },   // texto grande a pantalla
    title:  { en: 'Don\'t give up!', es: '¡No te rindas!' },
    sub:    { en: 'You ran out of hearts. Want to try again?',
              es: 'Te quedaste sin corazones. ¿Quieres intentarlo de nuevo?' },
    retry:  { en: 'Try again', es: 'Reintentar' },
    exit:   { en: 'Leave',     es: 'Salir' },
  },
}

// Modal de resultado del minijuego: victoria (muestra la llave obtenida + cara
// de main feliz + botón Continuar) o derrota (mensaje de ánimo + Reintentar /
// Salir). Reusa el estilo modal (paleta del minijuego). El mundo queda congelado
// (lo puso Phaser); al elegir, avisa a Phaser con game-result-done {action}.
function GameResult() {
  const [result, setResult] = useState(null)   // 'win' | 'lose' | null
  const [phase, setPhase]   = useState('box')   // derrota: 'slam' → 'box'
  const [lang] = useState('en')                // idioma fijo (podría heredarse)
  const palette = getPalette('listen-choose')

  useEffect(() => {
    const onResult = (e) => {
      const r = e.detail?.result ?? null
      setResult(r)
      // La derrota empieza con el texto grande "¡Perdiste!" (slam) + sonido de
      // defeat y, tras un momento, pasa al recuadro del doctor con Reintentar/Salir.
      setPhase(r === 'lose' ? 'slam' : 'box')
      if (r === 'lose') playSfx('defeat')
    }
    window.addEventListener('game-result', onResult)
    return () => window.removeEventListener('game-result', onResult)
  }, [])

  // Transición slam → box en la derrota.
  useEffect(() => {
    if (result === 'lose' && phase === 'slam') {
      const id = setTimeout(() => setPhase('box'), 1400)
      return () => clearTimeout(id)
    }
  }, [result, phase])

  if (!result) return null
  const t = RESULT_TEXT[result]
  const cafe = palette.primary

  const finish = (action) => {
    playSfx('click')
    setResult(null)
    window.dispatchEvent(new CustomEvent('game-result-done', { detail: { action } }))
  }

  // Fase 1 de la derrota: texto grande "¡Perdiste!" a pantalla completa, sin recuadro.
  if (result === 'lose' && phase === 'slam') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.62)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Nunito', animation: 'help-fade 0.2s ease', pointerEvents: 'auto',
      }}>
        <div className="lose-slam" style={{
          fontSize: 'clamp(48px, 12vw, 110px)', fontWeight: 800,
          color: '#ffffff', textAlign: 'center', letterSpacing: '0.02em',
          textShadow: '0 6px 0 rgba(0,0,0,0.25), 0 0 30px rgba(0,0,0,0.4)',
          userSelect: 'none', WebkitUserSelect: 'none', caretColor: 'transparent',
          pointerEvents: 'none',
        }}>
          {t.slam[lang]}
        </div>
      </div>
    )
  }

  // Fase 2 (derrota) y victoria: el recuadro modal.
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Nunito', animation: 'help-fade 0.2s ease',
      pointerEvents: 'auto',
    }}>
      <div style={{
        background: '#ffffff', borderRadius: 20,
        width: 'min(92vw, 460px)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
        overflow: 'hidden',
        animation: 'help-pop 0.32s cubic-bezier(0.34, 1.3, 0.7, 1)',
      }}>
        {/* Barra de color superior */}
        <div style={{ height: 8, background: cafe }} />

        <div style={{
          padding: '26px 28px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          textAlign: 'center',
        }}>
          {/* Victoria: la llave grande. Derrota: cara del doctor hablando. */}
          {result === 'win' ? (
            <div className="win-key">
              <img
                className="win-key-inner"
                src="/assets/ui/key.png"
                alt="key"
                style={{ width: 120, height: 'auto', imageRendering: 'pixelated',
                         filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.25))' }}
              />
            </div>
          ) : (
            <div className="doctor-face-talk" style={{ '--face-size': '100px' }} />
          )}

          <div style={{ fontSize: 24, fontWeight: 800, color: palette.dark }}>
            {t.title[lang]}
          </div>
          <div style={{ fontSize: 16, lineHeight: 1.4, color: '#5a5a5a', maxWidth: 340 }}>
            {t.sub[lang]}
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            {result === 'win' ? (
              <button
                onClick={() => finish('continue')}
                style={btnStyle(cafe, '#ffffff')}
              >{t.button[lang]}</button>
            ) : (
              <>
                <button
                  onClick={() => finish('retry')}
                  style={btnStyle(cafe, '#ffffff')}
                >{t.retry[lang]}</button>
                <button
                  onClick={() => finish('exit')}
                  style={btnStyle('#ffffff', cafe, cafe)}
                >{t.exit[lang]}</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Estilo de botón tipo píldora para el modal de resultado.
function btnStyle(bg, color, border) {
  return {
    padding: '11px 32px', borderRadius: 14,
    background: bg, color,
    border: border ? `2px solid ${border}` : 'none',
    fontFamily: 'Nunito', fontSize: 16, fontWeight: 800,
    cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
  }
}

// Textos de recuadros del HUD (indicación Q, etc.) como overlay HTML nítido.
// Cada texto se centra dentro de su caja {x,y,w,h} en coordenadas de pantalla.
function HudTexts({ texts }) {
  if (!texts?.length) return null
  return (
    <>
      {texts.map((t) => {
        const align = t.align ?? 'left'
        const justify = align === 'center' ? 'center' : (align === 'right' ? 'flex-end' : 'flex-start')
        return (
        <div key={t.id} style={{
          position: 'absolute', left: t.x, top: t.y, width: t.w, height: t.h,
          display: 'flex', alignItems: 'center', justifyContent: justify,
          pointerEvents: 'none', zIndex: 25, textAlign: align,
          fontFamily: 'Nunito', fontWeight: 700, fontSize: t.size ?? 18,
          color: '#2D2016', lineHeight: t.lineHeight ?? 1.25, whiteSpace: 'pre-line',
          userSelect: 'none', WebkitUserSelect: 'none', caretColor: 'transparent',
        }}>
          {t.text}
        </div>
        )
      })}
    </>
  )
}

// Recuadro de confirmación Yes/No: el recuadro (imagen) lo dibuja Phaser; acá
// van el texto de arriba y los botones clickeables (mouse), posicionados sobre
// sus cajas en coordenadas de pantalla. Al hacer clic, avisa a Phaser.
function ConfirmBox({ data }) {
  // Fuente del marcado: 'kbd' (selección por teclado) o 'mouse' (hover).
  const [mode, setMode] = useState('kbd')
  const [hovered, setHovered] = useState(null)
  const selected = data?.selected
  // Cuando el teclado fija una selección (no null), toma el control.
  useEffect(() => { if (selected != null) setMode('kbd') }, [selected])
  if (!data) return null
  const { prompt, buttons } = data
  const click = (id) => {
    playSfx('click')
    window.dispatchEvent(new CustomEvent('confirm-result', { detail: { id } }))
  }
  const HL = 'rgba(0,0,0,0.12)'
  // Índice marcado: si el mouse manda, el que esté bajo el cursor (o ninguno);
  // si manda el teclado, el seleccionado.
  const markedIdx = mode === 'mouse' ? hovered : selected
  return (
    <>
      {/* Texto de confirmación (arriba) */}
      <div style={{
        position: 'absolute', left: prompt.x, top: prompt.y, width: prompt.w, height: prompt.h,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none', zIndex: 26, textAlign: 'center',
        fontFamily: 'Nunito', fontWeight: 700, fontSize: 24, color: '#2D2016',
        userSelect: 'none', WebkitUserSelect: 'none',
      }}>
        {prompt.text}
      </div>
      {/* Botones Yes / No. El mouse tiene prioridad: al entrar marca ese; al
          salir, ninguno queda marcado. Al usar el teclado, vuelve el marcado
          por selección. */}
      {buttons.map((b, i) => (
        <div key={b.id}
          onClick={() => click(b.id)}
          onMouseEnter={() => {
            setMode('mouse'); setHovered(i)
            // el mouse toma el control → invalida la selección de teclado en Phaser
            window.dispatchEvent(new CustomEvent('confirm-kbd-off'))
          }}
          onMouseLeave={() => { setMode('mouse'); setHovered(null) }}
          style={{
            position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 27, borderRadius: 8,
            background: i === markedIdx ? HL : 'transparent', transition: 'background 0.12s',
            fontFamily: 'Nunito', fontWeight: 800, fontSize: 20, color: '#2D2016',
            userSelect: 'none', WebkitUserSelect: 'none',
          }}>
          {b.text}
        </div>
      ))}
    </>
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
