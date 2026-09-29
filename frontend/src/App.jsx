import './styles/index.css'
import { AppProvider, useApp } from './context/AppContext'
import LandingPage  from './pages/LandingPage'
import Dashboard    from './pages/Dashboard'
import SkillTree    from './pages/SkillTree'

function Router() {
  const { page } = useApp()
  if (page === 'landing')    return <LandingPage />
  if (page === 'dashboard')  return <Dashboard />
  if (page === 'skilltree')  return <SkillTree />
  return <LandingPage />
}

export default function App() {
  return (
    <AppProvider>
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
        <Router />
      </div>
    </AppProvider>
  )
}
