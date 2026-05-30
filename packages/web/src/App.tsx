import { useEffect, useRef, useState } from 'react'
import { Link, Route, Routes, useNavigate } from 'react-router-dom'
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
import H2HPage from './pages/H2HPage'

function NavLink({ to, children, color }: { to: string; children: React.ReactNode; color: 'magenta' | 'cyan' | 'purple' }) {
  return (
    <Link to={to} className="transition hover:scale-[1.03]">
      <NeonChip color={color} className="text-sm">
        {children}
      </NeonChip>
    </Link>
  )
}

// === Глобальный поиск игроков ===
type PlayerHit = {
  playerId: string
  nickname: string
  avatar?: string | null
  country?: string | null
  matches?: number
  rating?: number
}

function initials(nickname: string): string {
  const parts = nickname.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function countryFlag(country?: string | null): string {
  if (!country || country.length !== 2) return ''
  const cc = country.toUpperCase()
  if (!/^[A-Z]{2}$/.test(cc)) return ''
  const base = 0x1f1e6
  return String.fromCodePoint(base + (cc.charCodeAt(0) - 65), base + (cc.charCodeAt(1) - 65))
}

function GlobalSearch() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [items, setItems] = useState<PlayerHit[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(-1)
  const boxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    const term = q.trim()
    if (!term) {
      setItems([])
      setActive(-1)
      return
    }
    let alive = true
    const t = setTimeout(() => {
      setLoading(true)
      fetch(`/api/search?q=${encodeURIComponent(term)}&limit=10`)
        .then((r) => (r.ok ? r.json() : Promise.reject(r)))
        .then((d: { items?: PlayerHit[] }) => {
          if (!alive) return
          setItems(Array.isArray(d?.items) ? d.items : [])
          setActive(-1)
        })
        .catch(() => {
          if (alive) setItems([])
        })
        .finally(() => {
          if (alive) setLoading(false)
        })
    }, 220)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q])

  function go(p: PlayerHit) {
    setOpen(false)
    setQ('')
    setItems([])
    navigate(`/players/${p.playerId}`)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      if (active >= 0 && active < items.length) go(items[active])
      else if (items.length > 0) go(items[0])
    }
  }

  return (
    <div ref={boxRef} className="relative w-full sm:w-64">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neon-cyan">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Поиск игроков…"
          aria-label="Поиск игроков"
          className="w-full rounded-xl border border-neon-cyan/40 bg-bg-soft/70 py-2 pl-9 pr-3 font-display text-sm tracking-wide text-text shadow-neon-cyan/30 outline-none transition focus:border-neon-cyan placeholder:text-text-dim"
        />
      </div>

      {open && q.trim().length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-neon-cyan/40 bg-bg-elev/95 shadow-neon-cyan backdrop-blur-sm">
          {loading && <div className="px-3 py-3 text-sm text-text-dim">Загрузка…</div>}
          {!loading && items.length === 0 && (
            <div className="px-3 py-3 text-sm text-text-dim">Ничего не найдено</div>
          )}
          {!loading &&
            items.map((it, idx) => (
              <button
                key={it.playerId}
                type="button"
                onMouseEnter={() => setActive(idx)}
                onClick={() => go(it)}
                className={`flex w-full items-center gap-3 border-b border-white/5 px-3 py-2 text-left transition ${
                  idx === active ? 'bg-neon-cyan/10' : 'hover:bg-neon-cyan/5'
                }`}
              >
                {it.avatar ? (
                  <img
                    src={it.avatar}
                    alt={it.nickname}
                    className="h-7 w-7 rounded-full border-2 border-neon-cyan object-cover"
                  />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-neon-cyan bg-bg font-display text-[10px] text-neon-cyan">
                    {initials(it.nickname)}
                  </span>
                )}
                <span className="flex-1 truncate text-sm text-text">
                  {countryFlag(it.country)} {it.nickname}
                </span>
                {typeof it.rating === 'number' && (
                  <span className="font-display text-xs text-neon-cyan">{Math.round(it.rating)}</span>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
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
          <NavLink to="/h2h" color="cyan">
            H2H
          </NavLink>
          <div className="ml-auto w-full sm:w-auto">
            <GlobalSearch />
          </div>
        </nav>
      </NeonCard>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/matches" element={<MatchesPage />} />
        <Route path="/matches/:id" element={<MatchPage />} />
        <Route path="/maps" element={<MapsPage />} />
        <Route path="/maps/:map" element={<MapDetailPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/h2h" element={<H2HPage />} />
        <Route path="/players/:id" element={<PlayerPage />} />
      </Routes>

      <footer className="mt-12 border-t border-neon-purple/15 pt-6 text-center text-xs text-text-dim">
        SIGMA ZADROTS — статистика FACEIT Hub · CS2
      </footer>
    </div>
  )
}
