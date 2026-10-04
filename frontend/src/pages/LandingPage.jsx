import { useEffect, useState, useRef } from 'react'
import { useApp } from '../context/AppContext'

// ── Pure-JS EncryptedText (no external deps needed) ─────────────────────────
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*'

function useEncryptedText(target, startDelay = 0, speed = 40) {
  const [display, setDisplay] = useState('')
  const [done, setDone]       = useState(false)
  const frame = useRef(0)
  const iter  = useRef(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        iter.current += 0.5
        const resolved = Math.floor(iter.current)
        if (resolved >= target.length) {
          setDisplay(target)
          setDone(true)
          clearInterval(interval)
          return
        }
        setDisplay(
          target
            .split('')
            .map((char, idx) => {
              if (char === ' ') return ' '
              if (idx < resolved) return char
              return CHARSET[Math.floor(Math.random() * CHARSET.length)]
            })
            .join('')
        )
        frame.current++
      }, speed)
      return () => clearInterval(interval)
    }, startDelay)
    return () => clearTimeout(timer)
  }, [target, startDelay, speed])

  return { display, done }
}

export default function LandingPage() {
  const { navigateTo } = useApp()
  const [showSub, setShowSub]     = useState(false)
  const [showBtn, setShowBtn]     = useState(false)
  const [exiting, setExiting]     = useState(false)

  const title = useEncryptedText('NEUROTREE', 400, 35)
  const sub   = useEncryptedText('Your AI Study Buddy', 1800, 30)

  // Show subtitle after title resolves
  useEffect(() => { if (title.done) setShowSub(true) }, [title.done])
  useEffect(() => { if (sub.done)   setTimeout(() => setShowBtn(true), 300) }, [sub.done])

  function handleEnter() {
    if (exiting) return
    setExiting(true)
    setTimeout(() => navigateTo('dashboard'), 600)
  }

  return (
    <div
      className={[
        'w-full h-full flex flex-col items-center justify-center bg-app',
        'transition-opacity duration-500',
        exiting ? 'opacity-0' : 'opacity-100',
      ].join(' ')}
      style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% 60%, rgba(77,124,254,0.12) 0%, transparent 70%), #111315',
      }}
    >
      {/* Ambient orb */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 480, height: 480,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(77,124,254,0.08) 0%, transparent 70%)',
          filter: 'blur(40px)',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      {/* Main title */}
      <div className="relative z-10 text-center select-none">
        <h1
          className="font-mono tracking-[0.25em] font-bold"
          style={{
            fontSize: 'clamp(2.5rem, 8vw, 5rem)',
            color: '#F0F2F5',
            textShadow: title.done
              ? '0 0 40px rgba(77,124,254,0.4), 0 0 80px rgba(77,124,254,0.15)'
              : 'none',
            transition: 'text-shadow 1s ease',
            letterSpacing: '0.3em',
          }}
        >
          {title.display || '\u00A0'}
        </h1>

        {/* Subtitle */}
        <p
          className="mt-4 font-mono tracking-widest text-sm transition-all duration-700"
          style={{
            color: 'rgba(240,242,245,0.55)',
            letterSpacing: '0.2em',
            opacity: showSub ? 1 : 0,
            transform: showSub ? 'translateY(0)' : 'translateY(8px)',
          }}
        >
          {sub.display || '\u00A0'}
        </p>

        {/* Thin separator line */}
        <div
          className="mx-auto mt-6 h-px transition-all duration-700"
          style={{
            width: showSub ? '120px' : '0px',
            background: 'linear-gradient(90deg, transparent, rgba(77,124,254,0.6), transparent)',
          }}
        />

        {/* CTA button */}
        <div
          className="mt-10 transition-all duration-500"
          style={{ opacity: showBtn ? 1 : 0, transform: showBtn ? 'translateY(0)' : 'translateY(12px)' }}
        >
          <button
            onClick={handleEnter}
            className="btn-liquid px-10 py-3 text-sm tracking-widest font-medium"
            style={{ letterSpacing: '0.15em' }}
          >
            ENTER →
          </button>
        </div>

        {/* Version badge */}
        <p
          className="mt-8 font-mono text-xs transition-opacity duration-700"
          style={{ color: 'rgba(240,242,245,0.2)', opacity: showBtn ? 1 : 0 }}
        >
          IBM SkillsBuild Hackathon
        </p>
      </div>
    </div>
  )
}
