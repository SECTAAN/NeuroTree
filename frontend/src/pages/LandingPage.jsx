import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import BackgroundRippleEffect from '../components/ui/BackgroundRippleEffect'

/**
 * LandingPage — M-19 Skeuomorphic redesign.
 *
 * Visual language: warm parchment (#faf2e3), deep teal primary (#354e47),
 * coral accent (#db6271). Organic brain SVG illustration, soft depth shadows,
 * tactile raised button. Retains the fade-in sequence.
 *
 * BackgroundRippleEffect: Aceternity-inspired concentric ring animation lives
 * behind all hero content (z-0), clipped to this section, pointer-events-none.
 *
 * Behavior: unchanged — click ENTER to navigate to dashboard.
 * Auto-advance removed (was P1-6 open issue; confirmed intentional removal).
 */
export default function LandingPage() {
  const { navigateTo } = useApp()
  const [phase, setPhase]   = useState(0)   // 0→logo, 1→sub, 2→btn
  const [exiting, setExiting] = useState(false)

  // Staggered entrance
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400)
    const t2 = setTimeout(() => setPhase(2), 1000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  function handleEnter() {
    if (exiting) return
    setExiting(true)
    setTimeout(() => navigateTo('intro'), 500)
  }

  return (
    <div
      className={[
        'w-full h-full flex flex-col items-center justify-center bg-app relative overflow-hidden',
        'transition-opacity duration-500',
        exiting ? 'opacity-0' : 'opacity-100',
      ].join(' ')}
    >
      {/* ── Ripple effect — Aceternity cell-ripple grid, z-0 behind content ── */}
      <BackgroundRippleEffect
        cellSize={60}
        rippleSpeed={200}
        className="z-0"
      />

      {/* ── Organic background shapes ──────────────────────────────────────── */}
      <BgShape
        style={{
          width: 420, height: 420,
          borderRadius: '60% 40% 70% 30% / 50% 60% 40% 50%',
          background: 'rgba(53,78,71,0.07)',
          top: '-80px', right: '-100px',
        }}
      />
      <BgShape
        style={{
          width: 320, height: 320,
          borderRadius: '40% 60% 30% 70% / 60% 40% 70% 30%',
          background: 'rgba(219,98,113,0.06)',
          bottom: '-60px', left: '-80px',
        }}
      />
      <BgShape
        style={{
          width: 180, height: 180,
          borderRadius: '50%',
          background: 'rgba(53,78,71,0.05)',
          top: '30%', left: '8%',
        }}
      />

      {/* ── Main card — z-10 keeps it above ripple ─────────────────────────── */}
      <div
        className="relative z-10 flex flex-col items-center text-center px-8"
        style={{ maxWidth: 520 }}
      >
        {/* Brain SVG illustration */}
        <div
          className="mb-8 transition-all duration-700"
          style={{
            opacity: phase >= 1 ? 1 : 0,
            transform: phase >= 1 ? 'translateY(0)' : 'translateY(12px)',
          }}
        >
          <BrainIllustration />
        </div>

        {/* Logo */}
        <h1
          className="font-serif font-semibold tracking-wide transition-all duration-700"
          style={{
            fontSize: 'clamp(2.4rem, 7vw, 4rem)',
            color: 'var(--nt-primary)',
            letterSpacing: '0.04em',
            opacity: phase >= 1 ? 1 : 0,
            transform: phase >= 1 ? 'translateY(0)' : 'translateY(10px)',
          }}
        >
          NeuroTree
        </h1>

        {/* Subtitle */}
        <p
          className="mt-3 text-base font-normal transition-all duration-700"
          style={{
            color: 'var(--nt-text-2)',
            letterSpacing: '0.01em',
            lineHeight: 1.6,
            opacity: phase >= 1 ? 1 : 0,
            transform: phase >= 1 ? 'translateY(0)' : 'translateY(8px)',
            transitionDelay: '150ms',
          }}
        >
          Your AI-powered adaptive learning companion.<br />
          Transform any material into a living knowledge circuit.
        </p>

        {/* Decorative divider */}
        <div
          className="mt-6 mb-8 transition-all duration-700"
          style={{
            width: phase >= 2 ? 80 : 0,
            height: 2,
            borderRadius: 2,
            background: 'linear-gradient(90deg, transparent, var(--nt-coral), transparent)',
            transitionDelay: '200ms',
          }}
        />

        {/* CTA Button */}
        <button
          onClick={handleEnter}
          className="nt-btn-primary px-10 py-3.5 text-sm font-medium tracking-wider transition-all duration-500"
          style={{
            fontSize: '0.875rem',
            letterSpacing: '0.10em',
            opacity: phase >= 2 ? 1 : 0,
            transform: phase >= 2 ? 'translateY(0)' : 'translateY(10px)',
            transitionDelay: '250ms',
          }}
        >
          Begin Learning →
        </button>

        {/* Badge */}
        <p
          className="mt-8 text-xs transition-opacity duration-700"
          style={{
            color: 'var(--nt-text-3)',
            opacity: phase >= 2 ? 0.7 : 0,
            transitionDelay: '400ms',
          }}
        >
          IBM SkillsBuild Hackathon
        </p>
      </div>
    </div>
  )
}

/* ── Background organic blob ─────────────────────────────────────────────── */
function BgShape({ style }) {
  return (
    <div
      className="absolute pointer-events-none z-[1]"
      style={{ filter: 'blur(2px)', ...style }}
    />
  )
}

/* ── Brain illustration SVG (organic outline style, brand-coloured) ──────── */
function BrainIllustration() {
  return (
    <svg
      width="160"
      height="120"
      viewBox="0 0 200 150"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Left hemisphere */}
      <path
        d="M100 115 C100 115 60 120 45 100 C30 80 28 55 35 40
           C42 25 55 18 68 20 C72 12 82 8 90 12
           C92 8 98 6 100 10"
        stroke="var(--nt-primary)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="rgba(53,78,71,0.06)"
      />
      {/* Right hemisphere */}
      <path
        d="M100 10 C102 6 108 8 110 12
           C118 8 128 12 132 20 C145 18 158 25 165 40
           C172 55 170 80 155 100 C140 120 100 115 100 115"
        stroke="var(--nt-primary)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="rgba(53,78,71,0.06)"
      />
      {/* Centre divider */}
      <line x1="100" y1="10" x2="100" y2="115"
        stroke="var(--nt-primary)" strokeWidth="1.4" strokeDasharray="4 3" strokeLinecap="round" />
      {/* Cortex folds — left */}
      <path d="M55 45 C62 40 70 44 68 52" stroke="var(--nt-primary)" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M45 65 C52 58 62 62 60 70" stroke="var(--nt-primary)" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M50 85 C58 78 68 82 66 90" stroke="var(--nt-primary)" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M72 32 C80 27 88 30 86 38" stroke="var(--nt-primary)" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M70 55 C78 50 86 53 84 62" stroke="var(--nt-primary)" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M68 75 C76 70 84 73 82 82" stroke="var(--nt-primary)" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      {/* Cortex folds — right */}
      <path d="M145 45 C138 40 130 44 132 52" stroke="var(--nt-primary)" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M155 65 C148 58 138 62 140 70" stroke="var(--nt-primary)" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M150 85 C142 78 132 82 134 90" stroke="var(--nt-primary)" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M128 32 C120 27 112 30 114 38" stroke="var(--nt-primary)" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M130 55 C122 50 114 53 116 62" stroke="var(--nt-primary)" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M132 75 C124 70 116 73 118 82" stroke="var(--nt-primary)" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      {/* Neural sparks — coral dots */}
      <circle cx="75" cy="40"  r="2.5" fill="var(--nt-coral)" opacity="0.75" />
      <circle cx="125" cy="40" r="2.5" fill="var(--nt-coral)" opacity="0.75" />
      <circle cx="65"  cy="70" r="2"   fill="var(--nt-coral)" opacity="0.60" />
      <circle cx="135" cy="70" r="2"   fill="var(--nt-coral)" opacity="0.60" />
      <circle cx="80"  cy="95" r="2"   fill="var(--nt-primary-lt, #4e7267)" opacity="0.65" />
      <circle cx="120" cy="95" r="2"   fill="var(--nt-primary-lt, #4e7267)" opacity="0.65" />
      {/* Stem / brainstem */}
      <path d="M88 115 C90 125 100 130 112 125 C114 118 108 115 100 115"
        stroke="var(--nt-primary)"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="rgba(53,78,71,0.04)"
      />
    </svg>
  )
}
