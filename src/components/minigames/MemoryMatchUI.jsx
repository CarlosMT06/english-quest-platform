import { useState, useEffect } from 'react'
import { playSfx } from '../../utils/sfx'
import { scoreMessage } from '../../utils/scoreMessage'
import { DEFAULT_PALETTE } from '../../theme/palettes'
import Celebration from '../Celebration'

const shuffle = arr => [...arr].sort(() => Math.random() - 0.5)

// Toma `count` items al azar y arma la baraja: por cada item, una carta de
// imagen y otra de oración (misma pairId). Cada carta guarda el audio del
// item (mismo de ListenImage) para reproducirlo al emparejar.
function buildDeck(items, count, imgBase, audioBase) {
  const chosen = shuffle(items).slice(0, count)
  const cards = []
  chosen.forEach(it => {
    const audio = it.audio ? audioBase + it.audio : null
    cards.push({ pairId: it.id, type: 'image', content: imgBase + it.image, audio })
    cards.push({ pairId: it.id, type: 'text',  content: it.sentence,        audio })
  })
  return shuffle(cards).map((c, i) => ({ ...c, key: i }))
}

export default function MemoryMatchUI({ unitData, score, onScoreChange, palette = DEFAULT_PALETTE }) {
  const { bg, soft, accent, primary, dark } = palette
  const config    = unitData.minigames['memory-match']
  const imgBase   = unitData.paths.images
  const audioBase = unitData.paths.audioImage
  const pairs     = config.pairs ?? 6

  const [cards]   = useState(() => buildDeck(config.items, pairs, imgBase, audioBase))
  const [flipped, setFlipped]     = useState([])          // índices volteados (0-2)
  const [matched, setMatched]     = useState(new Set())   // pairIds emparejados
  const [seen, setSeen]           = useState(new Set())   // índices ya revelados alguna vez
  const [mismatches, setMismatches] = useState(0)         // fallos "de memoria" (penalizados)
  const [lock, setLock]           = useState(false)
  const [finished, setFinished]   = useState(false)

  // Fin de partida cuando todas las parejas están emparejadas
  useEffect(() => {
    if (matched.size === pairs) {
      // 1000 − 25 por cada fallo "de memoria" (parejas ya vistas que no se recordaron)
      const total = Math.max(0, 1000 - mismatches * 25)
      onScoreChange(total)
      // Espera 3s antes de la pantalla de victoria para que no se traslape
      // el audio de la última pareja con el sonido de victoria.
      setTimeout(() => setFinished(true), 3000)
    }
  }, [matched])

  function handleFlip(index) {
    if (lock) return
    const card = cards[index]
    if (matched.has(card.pairId) || flipped.includes(index)) return

    if (flipped.length === 0) {
      setFlipped([index])
      return
    }

    // Segunda carta
    const firstIdx = flipped[0]
    const first = cards[firstIdx]
    setFlipped([firstIdx, index])
    setLock(true)

    if (first.pairId === card.pairId) {
      playSfx('correct')
      if (card.audio) setTimeout(() => new Audio(card.audio).play().catch(() => {}), 400)
      setTimeout(() => {
        setMatched(prev => new Set(prev).add(card.pairId))
        setSeen(prev => new Set(prev).add(firstIdx).add(index))
        setFlipped([])
        setLock(false)
      }, 650)
    } else {
      playSfx('wrong')
      // Cada carta tiene UN volteo erróneo gratis (memorización). Penaliza si
      // al menos una de las dos ya se había visto (se voltea mal por 2ª vez).
      if (seen.has(firstIdx) || seen.has(index)) {
        setMismatches(prev => prev + 1)
      }
      setSeen(prev => new Set(prev).add(firstIdx).add(index))
      setTimeout(() => {
        setFlipped([])
        setLock(false)
      }, 1500)
    }
  }

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
      </div>
    )
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 20,
      background: bg, padding: '20px 40px 28px',
      fontFamily: 'Nunito', position: 'relative', overflow: 'hidden',
    }}>

      {/* Decorative blobs */}
      <div style={{ position: 'absolute', top: -55, right: -55, width: 210, height: 210, borderRadius: '50%', background: primary + '16', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 30, left: -75, width: 250, height: 250, borderRadius: '50%', background: accent + '28', pointerEvents: 'none' }} />

      {/* Progress (parejas encontradas) */}
      <div style={{ zIndex: 1 }}>
        <span style={{
          color: '#fff', fontSize: 15, fontWeight: 800,
          background: primary, padding: '6px 20px', borderRadius: 50,
          boxShadow: '0 3px 10px rgba(0,0,0,0.18)',
        }}>
          {matched.size} / {pairs}
        </span>
      </div>

      {/* Grilla 4×3 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 14, width: 'min(92vw, 720px)', zIndex: 1,
      }}>
        {cards.map((card, i) => {
          const isUp = flipped.includes(i) || matched.has(card.pairId)
          const isMatched = matched.has(card.pairId)
          return (
            <div
              key={card.key}
              onClick={() => handleFlip(i)}
              style={{ perspective: 1000, aspectRatio: '1 / 1', cursor: isUp ? 'default' : 'pointer' }}
            >
              <div style={{
                position: 'relative', width: '100%', height: '100%',
                transformStyle: 'preserve-3d', transition: 'transform 0.4s',
                transform: isUp ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}>
                {/* Dorso */}
                <div style={{
                  position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                  background: primary, borderRadius: 16,
                  border: `3px solid ${dark}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 34, fontWeight: 800,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}>?</div>

                {/* Frente */}
                <div style={{
                  position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  background: '#fff', borderRadius: 16,
                  border: `3px solid ${isMatched ? '#4CAB4D' : accent}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 10, textAlign: 'center', overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
                  opacity: isMatched ? 0.85 : 1,
                }}>
                  {card.type === 'image'
                    ? <img src={card.content} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <span style={{ color: dark, fontSize: 14, fontWeight: 800, lineHeight: 1.25 }}>{card.content}</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
