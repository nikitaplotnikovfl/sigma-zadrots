import { useEffect, useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { NeonCard, NeonChip, NeonLogo } from './components/Neon'
import { fetchOverview } from './api'
import { HUB } from './data/mock'
import ComparePage from './pages/ComparePage'
import HomePage from './pages/HomePage'
import MapsPage from './pages/MapsPage'
import MapDetailPage from './pages/MapDetailPage'
import MatchesPage from './pages/MatchesPage'
import MatchPage from './pages/MatchPage'
import PlayerPage from './pages/PlayerPage'

function NavLink({ to, children, color }: { to: string; children: React.ReactNode; color: 'magenta' | 'cyan' | 'purple' }) {
  return (
    <Link to={to} className="transition hover:scale-[1.03]">
      <NeonChip color={color} className="text-sm">
        {children}
      </NeonChip>
    </Link>
  )
}

export default function App() {
  const [sourceName, setSourceName] = useState(HUB.name)
  const [game, setGame] = useState(HUB.game)

  useEffect(() => {
    fetchOverview().then((o) => {
      if (o.live) {
        setSourceName(o.sourceName)
        setGame(o.game)
      }
    })
  }, [])

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <NeonCard color="magenta" className="mb-8 w-full px-6 py-6">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <Link to="/" className="transition hover:scale-[1.02]">
            <NeonLogo />
          </Link>
          <div className="text-center sm:text-right">
            <div className="font-display text-sm uppercase tracking-[0.3em] text-text-dim">
              Статистика турниров
            </div>
            <div className="mt-1 font-display text-xl font-bold text-neon-cyan neon-text-cyan">
              {sourceName} · {game}
            </div>
          </div>
        </div>
        <nav className="mt-6 flex flex-wrap items-center gap-3 border-t border-neon-magenta/15 pt-5">
          <NavLink to="/" color="magenta">
            Лидерборд
          </NavLink>
          <NavLink to="/matches" color="cyan">
            Матчи
          </NavLink>
          <NavLink to="/maps" color="purple">
            Карты
          </NavLink>
          <NavLink to="/compare" color="magenta">
            Сравнение
          </NavLink>
        </nav>
      </NeonCard>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/matches" element={<MatchesPage />} />
        <Route path="/matches/:id" element={<MatchPage />} />
        <Route path="/maps" element={<MapsPage />} />
        <Route path="/maps/:map" element={<MapDetailPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/players/:id" element={<PlayerPage />} />
      </Routes>

      <footer className="mt-12 border-t border-neon-purple/15 pt-6 text-center text-xs text-text-dim">
        SIGMA ZADROTS — статистика FACEIT Hub · CS2
      </footer>
    </div>
  )
}
