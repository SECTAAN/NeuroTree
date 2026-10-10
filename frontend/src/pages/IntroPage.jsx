import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext'

/**
 * IntroPage — M-19c: NeuroTree product introduction & education page.
 *
 * Journey: LandingPage → IntroPage → Dashboard (New Tree)
 *
 * Sections:
 *   A. Hero — What Is NeuroTree?
 *   B. Why NeuroTree? — Problem cards
 *   C. How It Works — Step-by-step workflow
 *   D. Adaptive Learning
 *   E. Chunking
 *   F. Career Pathway
 *   G. Final CTA
 *
 * Theme: uses existing global theme mechanism (localStorage 'neurotree-theme',
 *        html.dark class). No separate theme state.
 */

const STORAGE_KEY = 'neurotree-theme'

function applyThemeClass(theme) {
  const html = document.documentElement
  if (theme === 'dark') {
    html.classList.add('dark')
    html.classList.remove('theme-light')
  } else {
    html.classList.remove('dark')
    html.classList.add('theme-light')
  }
}

function getTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* ignore */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// ── Intersection Observer hook for reveal animations ─────────────────────────
function useReveal(threshold = 0.15) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) { setVisible(true); return }
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, visible]
}

// ── NeuroTree logo SVG (circuit-tree, from provided reference) ───────────────
function NTLogo({ size = 32 }) {
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 200 220" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="nt-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#00e5ff" />
          <stop offset="50%"  stopColor="#7c4dff" />
          <stop offset="100%" stopColor="#ff4081" />
        </linearGradient>
      </defs>
      {/* trunk */}
      <line x1="100" y1="195" x2="100" y2="130" stroke="url(#nt-grad)" strokeWidth="4" strokeLinecap="round"/>
      {/* base diamond */}
      <polygon points="100,215 70,195 100,175 130,195" stroke="url(#nt-grad)" strokeWidth="3" fill="none"/>
      <line x1="70" y1="195" x2="130" y2="195" stroke="url(#nt-grad)" strokeWidth="2"/>
      <circle cx="100" cy="175" r="5" stroke="url(#nt-grad)" strokeWidth="2.5" fill="none"/>
      {/* left main branch */}
      <line x1="100" y1="145" x2="55" y2="110" stroke="url(#nt-grad)" strokeWidth="3" strokeLinecap="round"/>
      {/* right main branch */}
      <line x1="100" y1="145" x2="145" y2="110" stroke="url(#nt-grad)" strokeWidth="3" strokeLinecap="round"/>
      {/* left sub-branches */}
      <line x1="55" y1="110" x2="20" y2="80"  stroke="url(#nt-grad)" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="55" y1="110" x2="45" y2="70"  stroke="url(#nt-grad)" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="55" y1="110" x2="68" y2="78"  stroke="url(#nt-grad)" strokeWidth="2.5" strokeLinecap="round"/>
      {/* left tips */}
      <circle cx="20"  cy="80"  r="5" stroke="url(#nt-grad)" strokeWidth="2.5" fill="none"/>
      <circle cx="45"  cy="70"  r="5" stroke="url(#nt-grad)" strokeWidth="2.5" fill="none"/>
      <circle cx="68"  cy="78"  r="5" stroke="url(#nt-grad)" strokeWidth="2.5" fill="none"/>
      {/* right sub-branches */}
      <line x1="145" y1="110" x2="180" y2="80"  stroke="url(#nt-grad)" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="145" y1="110" x2="155" y2="70"  stroke="url(#nt-grad)" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="145" y1="110" x2="132" y2="78"  stroke="url(#nt-grad)" strokeWidth="2.5" strokeLinecap="round"/>
      {/* right tips */}
      <circle cx="180" cy="80"  r="5" stroke="url(#nt-grad)" strokeWidth="2.5" fill="none"/>
      <circle cx="155" cy="70"  r="5" stroke="url(#nt-grad)" strokeWidth="2.5" fill="none"/>
      <circle cx="132" cy="78"  r="5" stroke="url(#nt-grad)" strokeWidth="2.5" fill="none"/>
      {/* top branches from trunk */}
      <line x1="100" y1="130" x2="85"  cy="95" stroke="url(#nt-grad)" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="100" y1="130" x2="115" cy="95" stroke="url(#nt-grad)" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="100" y1="130" x2="100" y2="12"  stroke="url(#nt-grad)" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="100" cy="12" r="5" stroke="url(#nt-grad)" strokeWidth="2.5" fill="none"/>
      <line x1="85"  y1="95" x2="75"  y2="40" stroke="url(#nt-grad)" strokeWidth="2" strokeLinecap="round"/>
      <line x1="115" y1="95" x2="125" y2="40" stroke="url(#nt-grad)" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="75"  cy="40" r="4" stroke="url(#nt-grad)" strokeWidth="2" fill="none"/>
      <circle cx="125" cy="40" r="4" stroke="url(#nt-grad)" strokeWidth="2" fill="none"/>
    </svg>
  )
}

// ── Section reveal wrapper ────────────────────────────────────────────────────
function RevealSection({ children, delay = 0, className = '' }) {
  const [ref, visible] = useReveal()
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity:    visible ? 1 : 0,
        transform:  visible ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

// ── Header ────────────────────────────────────────────────────────────────────
function IntroHeader({ onStart, onBack, theme, onToggleTheme }) {
  const [menuOpen, setMenuOpen] = useState(false)

  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMenuOpen(false)
  }

  const navLinks = [
    { label: 'What is NeuroTree?', id: 'section-why' },
    { label: 'How It Works',       id: 'section-how' },
    { label: 'Career Pathway',     id: 'section-career' },
  ]

  return (
    <header className="intro-header" role="banner">
      <div className="intro-header-inner">
        {/* Back button — returns to LandingPage */}
        <button
          className="intro-back-btn"
          onClick={onBack}
          aria-label="Back to entry screen"
          title="Back"
        >
          ← Back
        </button>

        {/* Wordmark */}
        <button
          className="intro-wordmark"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="NeuroTree — scroll to top"
        >
          <NTLogo size={28} />
          <span>NeuroTree</span>
        </button>

        {/* Desktop nav */}
        <nav className="intro-nav" aria-label="Intro navigation">
          {navLinks.map((l) => (
            <button key={l.id} className="intro-nav-link" onClick={() => scrollTo(l.id)}>
              {l.label}
            </button>
          ))}
        </nav>

        {/* Right controls */}
        <div className="intro-header-actions">
          {/* Theme toggle */}
          <button
            className="intro-theme-toggle"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀' : '◐'}
          </button>

          {/* CTA */}
          <button className="nt-btn-primary intro-cta-btn" onClick={onStart}>
            Start Learning →
          </button>

          {/* Mobile menu toggle */}
          <button
            className="intro-hamburger"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <nav className="intro-mobile-menu" aria-label="Mobile navigation">
          {navLinks.map((l) => (
            <button key={l.id} className="intro-mobile-link" onClick={() => scrollTo(l.id)}>
              {l.label}
            </button>
          ))}
          <button className="nt-btn-primary intro-mobile-cta" onClick={() => { onStart(); setMenuOpen(false) }}>
            Start Learning →
          </button>
        </nav>
      )}
    </header>
  )
}

// ── A. Hero ───────────────────────────────────────────────────────────────────
function HeroSection({ onStart }) {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 200)
    const t2 = setTimeout(() => setPhase(2), 600)
    const t3 = setTimeout(() => setPhase(3), 1000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  return (
    <section className="intro-hero" aria-labelledby="hero-headline">
      {/* Left: text */}
      <div className="intro-hero-text">
        <div
          className="intro-eyebrow"
          style={{ opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? 'none' : 'translateY(10px)', transition: 'all 0.6s ease' }}
        >
          IBM SkillsBuild · AI-Powered Learning
        </div>
        <h1
          id="hero-headline"
          className="intro-h1"
          style={{ opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? 'none' : 'translateY(14px)', transition: 'all 0.7s ease 100ms' }}
        >
          Your knowledge,<br />
          <span style={{ color: 'var(--nt-coral)' }}>wired into a tree.</span>
        </h1>
        <p
          className="intro-lead"
          style={{ opacity: phase >= 2 ? 1 : 0, transform: phase >= 2 ? 'none' : 'translateY(10px)', transition: 'all 0.6s ease 200ms' }}
        >
          NeuroTree turns any learning material — lecture slides, textbooks,
          research papers — into a connected knowledge circuit you can explore,
          quiz yourself on, and grow over time.
        </p>
        <div
          className="intro-hero-actions"
          style={{ opacity: phase >= 3 ? 1 : 0, transform: phase >= 3 ? 'none' : 'translateY(10px)', transition: 'all 0.6s ease 300ms' }}
        >
          <button className="nt-btn-primary intro-hero-cta" onClick={onStart}>
            Create Your First Tree →
          </button>
          <button
            className="nt-btn-secondary intro-hero-secondary"
            onClick={() => document.getElementById('section-how')?.scrollIntoView({ behavior: 'smooth' })}
          >
            See How It Works
          </button>
        </div>
      </div>

      {/* Right: illustration */}
      <div
        className="intro-hero-illo"
        style={{ opacity: phase >= 2 ? 1 : 0, transform: phase >= 2 ? 'none' : 'translateY(20px) scale(0.96)', transition: 'all 0.8s ease 400ms' }}
        aria-hidden="true"
      >
        <HeroIllustration />
      </div>
    </section>
  )
}

function HeroIllustration() {
  return (
    <div className="hero-illo-card clay-card" style={{ padding: 28, maxWidth: 340, margin: '0 auto' }}>
      <svg width="100%" viewBox="0 0 300 260" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        {/* trunk */}
        <line x1="150" y1="240" x2="150" y2="180" stroke="var(--nt-primary)" strokeWidth="2.5" strokeLinecap="round"/>
        {/* left branches */}
        <line x1="150" y1="195" x2="90"  y2="150" stroke="var(--nt-primary)" strokeWidth="2" strokeLinecap="round"/>
        <line x1="90"  y1="150" x2="50"  y2="110" stroke="var(--nt-primary)" strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="90"  y1="150" x2="80"  y2="100" stroke="var(--nt-primary)" strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="90"  y1="150" x2="115" y2="105" stroke="var(--nt-primary)" strokeWidth="1.8" strokeLinecap="round"/>
        {/* right branches */}
        <line x1="150" y1="195" x2="210" y2="150" stroke="var(--nt-primary)" strokeWidth="2" strokeLinecap="round"/>
        <line x1="210" y1="150" x2="250" y2="110" stroke="var(--nt-primary)" strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="210" y1="150" x2="220" y2="100" stroke="var(--nt-primary)" strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="210" y1="150" x2="185" y2="105" stroke="var(--nt-primary)" strokeWidth="1.8" strokeLinecap="round"/>
        {/* top branch */}
        <line x1="150" y1="180" x2="150" y2="60"  stroke="var(--nt-primary)" strokeWidth="2" strokeLinecap="round"/>
        <line x1="150" y1="110" x2="120" y2="75"  stroke="var(--nt-primary)" strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="150" y1="110" x2="180" y2="75"  stroke="var(--nt-primary)" strokeWidth="1.8" strokeLinecap="round"/>
        {/* nodes */}
        {[
          [150,240,'var(--nt-coral)',7],
          [150,180,'var(--nt-primary)',5],
          [90,150,'var(--nt-primary)',5],
          [210,150,'var(--nt-primary)',5],
          [50,110,'var(--nt-primary-lt)',4],
          [80,100,'var(--nt-primary-lt)',4],
          [115,105,'var(--nt-primary-lt)',4],
          [250,110,'var(--nt-primary-lt)',4],
          [220,100,'var(--nt-primary-lt)',4],
          [185,105,'var(--nt-primary-lt)',4],
          [150,60,'var(--nt-coral)',5],
          [120,75,'var(--nt-primary-lt)',4],
          [180,75,'var(--nt-primary-lt)',4],
        ].map(([cx,cy,fill,r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill={fill} opacity="0.85"/>
        ))}
        {/* node labels */}
        {[
          [38, 104, 'Networks'],
          [65, 94,  'OSI'],
          [102, 99, 'TCP/IP'],
          [238, 104,'Security'],
          [208, 94, 'Firewall'],
          [173, 99, 'VPN'],
          [107, 69, 'Protocols'],
          [167, 69, 'HTTP'],
        ].map(([x, y, t], i) => (
          <text key={i} x={x} y={y} fontSize="7.5" fill="var(--nt-text-3)" fontFamily="var(--font-primary)">{t}</text>
        ))}
        <text x="132" y="254" fontSize="8.5" fill="var(--nt-text-2)" fontFamily="var(--font-primary)" fontWeight="600">Computer Networking</text>
      </svg>
      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <span className="intro-badge">🌳 8 nodes · 3% mastered</span>
      </div>
    </div>
  )
}

// ── B. Why NeuroTree ──────────────────────────────────────────────────────────
function WhySection() {
  const cards = [
    {
      icon: '📄',
      title: 'Scattered materials',
      body: 'Lecture PDFs, notes, and slides exist in separate places with no visible connection between them.',
    },
    {
      icon: '🔗',
      title: 'No visible structure',
      body: 'It\'s hard to see which concepts depend on others, or where gaps in understanding actually are.',
    },
    {
      icon: '📏',
      title: 'Overwhelming scope',
      body: 'Large topics feel too big to start. Without a map, progress is invisible and motivation fades.',
    },
    {
      icon: '🧭',
      title: 'No direction after learning',
      body: 'Finishing a topic leaves the question: what career or skill path does this actually lead to?',
    },
  ]

  return (
    <section id="section-why" className="intro-section" aria-labelledby="why-heading">
      <RevealSection>
        <div className="intro-section-label">THE PROBLEM</div>
        <h2 id="why-heading" className="intro-h2">Learning is hard to organise.</h2>
        <p className="intro-section-lead">
          Most learners study in isolation — no structure, no feedback, no sense of direction.
          NeuroTree addresses these four recurring problems.
        </p>
      </RevealSection>
      <div className="intro-cards-grid">
        {cards.map((c, i) => (
          <RevealSection key={i} delay={i * 80}>
            <div className="intro-problem-card clay-card">
              <span className="intro-card-icon" aria-hidden="true">{c.icon}</span>
              <h3 className="intro-card-title">{c.title}</h3>
              <p className="intro-card-body">{c.body}</p>
            </div>
          </RevealSection>
        ))}
      </div>
    </section>
  )
}

// ── C. How It Works ───────────────────────────────────────────────────────────
function HowSection() {
  const steps = [
    { n: '01', title: 'Upload your material', body: 'Add a PDF, DOCX, or paste text. NeuroTree supports common document formats used in academic and professional learning.' },
    { n: '02', title: 'AI extracts the structure', body: 'NT-01 processes the material and identifies key concepts, their relationships, and dependency order — producing a structured knowledge graph.' },
    { n: '03', title: 'Explore the Tree Map', body: 'Every concept becomes a node (lamp) connected by relationship cables. Mastered nodes glow brighter; locked nodes unlock as prerequisites are met.' },
    { n: '04', title: 'Test with Active Recall', body: 'Click any unlocked node to start a quiz. NT-02 generates questions, NT-03 evaluates your answers, and mastery scores update your lamp brightness.' },
    { n: '05', title: 'Explore Career Pathway', body: 'Once you have a learning tree, NT-05 can compare your knowledge against career goals and suggest directions worth exploring.' },
  ]

  return (
    <section id="section-how" className="intro-section intro-section-alt" aria-labelledby="how-heading">
      <RevealSection>
        <div className="intro-section-label">THE WORKFLOW</div>
        <h2 id="how-heading" className="intro-h2">From material to mastery in five steps.</h2>
      </RevealSection>
      <div className="intro-steps">
        {steps.map((s, i) => (
          <RevealSection key={i} delay={i * 100}>
            <div className="intro-step">
              <div className="intro-step-num" aria-hidden="true">{s.n}</div>
              <div className="intro-step-content">
                <div className="intro-step-title">{s.title}</div>
                <div className="intro-step-body">{s.body}</div>
              </div>
            </div>
            {i < steps.length - 1 && <div className="intro-step-connector" aria-hidden="true" />}
          </RevealSection>
        ))}
      </div>
    </section>
  )
}

// ── D. Adaptive Learning ──────────────────────────────────────────────────────
function AdaptiveSection() {
  return (
    <section className="intro-section" aria-labelledby="adaptive-heading">
      <div className="intro-two-col">
        <RevealSection className="intro-two-col-text">
          <div className="intro-section-label">ADAPTIVE LEARNING</div>
          <h2 id="adaptive-heading" className="intro-h2">Progress at your own pace.</h2>
          <p className="intro-body-text">
            Adaptive learning means the system meets you where you are. NeuroTree
            implements this through a mastery-based unlock model: each knowledge
            node starts locked until its prerequisite nodes reach a{' '}
            <strong>70% mastery threshold</strong>. You cannot skip ahead
            by guessing — you advance by demonstrating actual understanding.
          </p>
          <blockquote className="intro-quote">
            <p>
              "The practice of retrieval is one of the most powerful learning
              strategies available — yet one of the least used."
            </p>
            <cite>— Henry L. Roediger III &amp; Mark A. McDaniel,{' '}
              <em>Make It Stick: The Science of Successful Learning</em> (2014)</cite>
          </blockquote>
          <p className="intro-body-text" style={{ marginTop: 16 }}>
            Each quiz in NeuroTree is powered by active recall — you retrieve
            knowledge from memory rather than re-reading. This is the
            technique behind spaced repetition systems and has been documented
            in cognitive science literature since the "testing effect" work of
            Roediger &amp; Karpicke (2006).
          </p>
        </RevealSection>
        <RevealSection delay={120} className="intro-two-col-illo">
          <MasteryIllustration />
        </RevealSection>
      </div>
    </section>
  )
}

function MasteryIllustration() {
  const nodes = [
    { label: 'Computer\nNetworking', x: 50,  y: 50,  mastery: 72, locked: false },
    { label: 'OSI Model',            x: 50,  y: 160, mastery: 45, locked: false },
    { label: 'TCP/IP',               x: 160, y: 105, mastery: 0,  locked: true  },
    { label: 'Subnetting',           x: 270, y: 50,  mastery: 0,  locked: true  },
  ]
  return (
    <div className="clay-card" style={{ padding: 20 }}>
      <svg width="100%" viewBox="0 0 340 220" fill="none" aria-label="Mastery unlock diagram">
        {/* edges */}
        <line x1="90"  y1="70"  x2="160" y2="125" stroke="var(--nt-primary)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5"/>
        <line x1="90"  y1="170" x2="160" y2="130" stroke="var(--nt-primary)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5"/>
        <line x1="220" y1="120" x2="270" y2="70"  stroke="var(--nt-border-2)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.4"/>
        {nodes.map((n, i) => {
          const glow = !n.locked && n.mastery >= 70
          const low  = !n.locked && n.mastery > 0 && n.mastery < 70
          return (
            <g key={i}>
              {glow && <circle cx={n.x+40} cy={n.y+30} r="30" fill="var(--nt-primary)" opacity="0.08"/>}
              <rect x={n.x} y={n.y} width="80" height="58" rx="10"
                fill={n.locked ? 'var(--nt-bg-3)' : 'var(--nt-surface)'}
                stroke={glow ? 'var(--nt-primary)' : n.locked ? 'var(--nt-border)' : 'var(--nt-border-2)'}
                strokeWidth={glow ? '1.8' : '1.2'}
                opacity={n.locked ? 0.55 : 1}
              />
              <text x={n.x+40} y={n.y+20} textAnchor="middle" fontSize="7.5"
                fill={n.locked ? 'var(--nt-text-3)' : 'var(--nt-text)'}
                fontFamily="var(--font-primary)" fontWeight="600">
                {n.label.split('\n')[0]}
              </text>
              {n.label.split('\n')[1] && (
                <text x={n.x+40} y={n.y+30} textAnchor="middle" fontSize="7.5"
                  fill={n.locked ? 'var(--nt-text-3)' : 'var(--nt-text)'}
                  fontFamily="var(--font-primary)" fontWeight="600">
                  {n.label.split('\n')[1]}
                </text>
              )}
              {n.locked
                ? <text x={n.x+40} y={n.y+47} textAnchor="middle" fontSize="9" fill="var(--nt-text-3)" fontFamily="var(--font-primary)">🔒 Locked</text>
                : (
                  <>
                    <rect x={n.x+8} y={n.y+40} width="64" height="6" rx="3" fill="var(--nt-bg-3)"/>
                    <rect x={n.x+8} y={n.y+40} width={`${0.64 * n.mastery}`} height="6" rx="3"
                      fill={n.mastery >= 70 ? 'var(--nt-primary)' : 'var(--nt-primary-lt)'}/>
                    <text x={n.x+72} y={n.y+47} textAnchor="end" fontSize="7" fill="var(--nt-text-3)" fontFamily="var(--font-primary)">{n.mastery}%</text>
                  </>
                )
              }
            </g>
          )
        })}
        {/* legend */}
        <rect x="10" y="195" width="10" height="6" rx="2" fill="var(--nt-primary)"/>
        <text x="24" y="201" fontSize="7.5" fill="var(--nt-text-3)" fontFamily="var(--font-primary)">Mastered ≥ 70%</text>
        <rect x="120" y="195" width="10" height="6" rx="2" fill="var(--nt-primary-lt)"/>
        <text x="134" y="201" fontSize="7.5" fill="var(--nt-text-3)" fontFamily="var(--font-primary)">In progress</text>
        <rect x="220" y="195" width="10" height="6" rx="2" fill="var(--nt-bg-3)" stroke="var(--nt-border)" strokeWidth="1"/>
        <text x="234" y="201" fontSize="7.5" fill="var(--nt-text-3)" fontFamily="var(--font-primary)">Locked</text>
      </svg>
    </div>
  )
}

// ── E. Chunking ───────────────────────────────────────────────────────────────
function ChunkingSection() {
  return (
    <section className="intro-section intro-section-alt" aria-labelledby="chunking-heading">
      <RevealSection>
        <div className="intro-section-label">KNOWLEDGE CHUNKING</div>
        <h2 id="chunking-heading" className="intro-h2">Large material, small meaningful units.</h2>
        <p className="intro-section-lead">
          A 200-page textbook becomes unnavigable as a single object.
          NeuroTree's NT-01 pipeline identifies discrete concepts and
          organises them into nodes — each with its own label, prerequisite
          relationships, and independent mastery score.
        </p>
      </RevealSection>

      <RevealSection delay={100}>
        <blockquote className="intro-quote intro-quote-center">
          <p>
            "Chunking is the process by which individual pieces of information
            are bound together into a meaningful whole."
          </p>
          <cite>— George A. Miller, "The Magical Number Seven, Plus or Minus Two" (1956),{' '}
            <em>Psychological Review</em></cite>
        </blockquote>
      </RevealSection>

      <RevealSection delay={140}>
        <ChunkingDiagram />
      </RevealSection>

      <RevealSection delay={180}>
        <div className="intro-chunking-note clay-card">
          <strong>What this is not:</strong> NeuroTree does not arbitrarily split text at fixed
          character counts. NT-01 extracts <em>conceptually coherent</em> units — a chunk
          is a distinct idea with a name, not a paragraph fragment.
          The number of nodes depends on the density and structure of the input material.
        </div>
      </RevealSection>
    </section>
  )
}

function ChunkingDiagram() {
  return (
    <div className="chunking-diagram">
      {/* Step 1: Document */}
      <div className="chunk-step clay-card">
        <div className="chunk-step-label">Source document</div>
        <svg width="100%" viewBox="0 0 120 90" fill="none" aria-hidden="true">
          <rect x="10" y="8" width="100" height="74" rx="6" fill="var(--nt-bg-3)" stroke="var(--nt-border-2)" strokeWidth="1.2"/>
          {[20,32,44,56,68].map((y,i) => (
            <rect key={i} x="18" y={y} width={i % 2 === 0 ? 84 : 60} height="5" rx="2" fill="var(--nt-border-2)" opacity="0.7"/>
          ))}
          <text x="60" y="84" textAnchor="middle" fontSize="8" fill="var(--nt-text-3)" fontFamily="var(--font-primary)">lecture.pdf</text>
        </svg>
      </div>

      <div className="chunk-arrow" aria-hidden="true">→</div>

      {/* Step 2: Chunks */}
      <div className="chunk-step">
        <div className="chunk-step-label">Knowledge chunks</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {['OSI Model', 'TCP/IP Suite', 'Subnetting', 'Routing'].map((t, i) => (
            <div key={i} className="clay-card" style={{ padding: '5px 10px', fontSize: '0.72rem', fontWeight: 500, color: 'var(--nt-primary)' }}>{t}</div>
          ))}
        </div>
      </div>

      <div className="chunk-arrow" aria-hidden="true">→</div>

      {/* Step 3: Tree */}
      <div className="chunk-step clay-card">
        <div className="chunk-step-label">Connected tree</div>
        <svg width="100%" viewBox="0 0 120 90" fill="none" aria-hidden="true">
          <line x1="60" y1="80" x2="60" y2="58" stroke="var(--nt-primary)" strokeWidth="1.5"/>
          <line x1="60" y1="65" x2="30" y2="40" stroke="var(--nt-primary)" strokeWidth="1.2"/>
          <line x1="60" y1="65" x2="90" y2="40" stroke="var(--nt-primary)" strokeWidth="1.2"/>
          <line x1="30" y1="40" x2="18" y2="18" stroke="var(--nt-primary)" strokeWidth="1"/>
          <line x1="30" y1="40" x2="42" y2="18" stroke="var(--nt-primary)" strokeWidth="1"/>
          <circle cx="60" cy="82" r="5" fill="var(--nt-coral)" opacity="0.85"/>
          <circle cx="60" cy="62" r="4" fill="var(--nt-primary)" opacity="0.85"/>
          <circle cx="30" cy="40" r="4" fill="var(--nt-primary)" opacity="0.85"/>
          <circle cx="90" cy="40" r="4" fill="var(--nt-primary)" opacity="0.85"/>
          <circle cx="18" cy="18" r="3" fill="var(--nt-primary-lt)" opacity="0.85"/>
          <circle cx="42" cy="18" r="3" fill="var(--nt-primary-lt)" opacity="0.85"/>
        </svg>
      </div>
    </div>
  )
}

// ── F. Career Pathway ─────────────────────────────────────────────────────────
function CareerSection({ onStart }) {
  const pathwayCards = [
    { icon: '📚', from: 'Computer Networking', to: 'Network Engineer', note: 'Indicative direction' },
    { icon: '🤖', from: 'Machine Learning Basics', to: 'AI/ML Engineer', note: 'Indicative direction' },
    { icon: '🔐', from: 'Cryptography + Networks', to: 'Security Analyst', note: 'Indicative direction' },
  ]

  return (
    <section id="section-career" className="intro-section" aria-labelledby="career-heading">
      <RevealSection>
        <div className="intro-section-label">CAREER PATHWAY</div>
        <h2 id="career-heading" className="intro-h2">Where does your knowledge lead?</h2>
        <p className="intro-section-lead">
          After building a learning tree, NeuroTree's Career Pathway (NT-05)
          compares your accumulated knowledge with known career skill profiles
          and surfaces directions worth exploring. These are exploratory suggestions,
          not employment guarantees or personalised career counselling.
        </p>
      </RevealSection>

      <div className="intro-cards-grid">
        {pathwayCards.map((c, i) => (
          <RevealSection key={i} delay={i * 80}>
            <div className="intro-pathway-card clay-card">
              <div className="pathway-icon" aria-hidden="true">{c.icon}</div>
              <div className="pathway-from">
                <span className="pathway-label">Learning topic</span>
                <span className="pathway-value">{c.from}</span>
              </div>
              <div className="pathway-arrow" aria-hidden="true">↓</div>
              <div className="pathway-to">
                <span className="pathway-label">Possible direction</span>
                <span className="pathway-value pathway-career">{c.to}</span>
              </div>
              <div className="pathway-note">{c.note}</div>
            </div>
          </RevealSection>
        ))}
      </div>

      <RevealSection delay={200}>
        <div className="intro-career-disclaimer clay-card">
          <strong>Transparency note:</strong> Career Pathway suggestions are generated by
          comparing your learning tree topics against career skill models using the NT-05
          Langflow flow. They reflect pattern matching, not verified career data or
          labour market analysis. Use them as a starting point for your own research.
        </div>
      </RevealSection>
    </section>
  )
}

// ── G. Final CTA ──────────────────────────────────────────────────────────────
function FinalCTA({ onStart }) {
  return (
    <section className="intro-final-cta intro-section-alt" aria-labelledby="final-cta-heading">
      <RevealSection>
        <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
          <div style={{ marginBottom: 24 }} aria-hidden="true">
            <NTLogo size={56} />
          </div>
          <h2 id="final-cta-heading" className="intro-h2" style={{ marginBottom: 16 }}>
            Ready to build your first tree?
          </h2>
          <p className="intro-body-text" style={{ marginBottom: 32, color: 'var(--nt-text-2)' }}>
            Upload any learning material — a textbook chapter, a lecture PDF, research notes —
            and NeuroTree will structure it into a knowledge circuit you can actually learn from.
          </p>
          <button className="nt-btn-primary intro-final-btn" onClick={onStart}>
            Create Your First Tree →
          </button>
          <p className="intro-footer-hint">
            No account required · IBM SkillsBuild Hackathon project
          </p>
        </div>
      </RevealSection>
    </section>
  )
}

// ── Main IntroPage ────────────────────────────────────────────────────────────
export default function IntroPage() {
  const { navigateTo } = useApp()

  // Local theme state — mirrors the global mechanism used by useCanvasTools
  const [theme, setTheme] = useState(() => {
    const t = getTheme()
    applyThemeClass(t)
    return t
  })

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      try { localStorage.setItem(STORAGE_KEY, next) } catch { /* ignore */ }
      applyThemeClass(next)
      return next
    })
  }, [])

  function handleStart() {
    navigateTo('dashboard')
  }

  function handleBack() {
    // Only call window.history.back() when history.state records a *different*
    // in-app page behind us (meaning the user navigated here from inside the app).
    // If state.page === 'intro' it means this is the first/only history entry
    // (fresh-tab direct load or replaceState seed) — back() would leave the app,
    // so we fall back to navigateTo('landing') instead.
    const prevPage = window.history.state?.page
    if (prevPage && prevPage !== 'intro') {
      window.history.back()
    } else {
      navigateTo('landing')
    }
  }

  return (
    <div
      className="intro-page bg-app"
      style={{ width: '100vw', height: '100vh', overflowY: 'auto', overflowX: 'hidden' }}
    >
      <IntroHeader onStart={handleStart} onBack={handleBack} theme={theme} onToggleTheme={toggleTheme} />

      <main id="intro-main">
        <HeroSection    onStart={handleStart} />
        <WhySection />
        <HowSection />
        <AdaptiveSection />
        <ChunkingSection />
        <CareerSection  onStart={handleStart} />
        <FinalCTA       onStart={handleStart} />
      </main>

      <footer className="intro-footer">
        <div className="intro-footer-inner">
          <div className="intro-footer-brand">
            <NTLogo size={20} />
            <span>NeuroTree</span>
          </div>
          <div className="intro-footer-meta">
            IBM SkillsBuild Hackathon · Built with Langflow + React
          </div>
        </div>
      </footer>
    </div>
  )
}
