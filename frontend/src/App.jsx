import './styles/index.css'
import { AppProvider, useApp } from './context/AppContext'
import LandingPage  from './pages/LandingPage'
import IntroPage    from './pages/IntroPage'
import Dashboard    from './pages/Dashboard'
import SkillTree    from './pages/SkillTree'
import CareerMap    from './pages/CareerMap'

function Router() {
  const { page } = useApp()
  if (page === 'landing')    return <LandingPage />
  if (page === 'intro')      return <IntroPage />
  if (page === 'dashboard')  return <Dashboard />
  if (page === 'skilltree')  return <SkillTree />
  if (page === 'careermap')  return <CareerMap />
  return <LandingPage />
}

// IntroPage manages its own scroll (overflowY: auto on its root div).
// All other pages are fixed viewport (overflow: hidden).
// The wrapper must not clip IntroPage, so we switch overflow per page.
function AppShell() {
  const { page } = useApp()
  const isScrollable = page === 'intro'
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      overflow: isScrollable ? 'visible' : 'hidden',
    }}>
      <Router />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}
