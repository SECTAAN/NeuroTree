import './styles/index.css'
import KnowledgeGraph from './components/KnowledgeGraph'

/**
 * App root — renders KnowledgeGraph full-screen.
 * Milestone 3 scope: just the canvas.
 * Routing (LandingPage, Ingestion, SkillTree pages) added in Milestone 4.
 */
export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <KnowledgeGraph />
    </div>
  )
}
