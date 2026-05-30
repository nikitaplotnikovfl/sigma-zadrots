import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { type PlayerRow } from '../data/mock'
import { fetchLeaderboard, fetchMaps, type MapRow } from '../api'
import { NeonCard } from './Neon'

type SortKey = keyof Pick<
  PlayerRow,
  'rank' | 'matches' | 'winrate' | 'kd' | 'kr' | 'adr' | 'hsPct' | 'kills' | 'mvps' | 'rating'
>

type Column = {
  key: SortKey
  label: string
  fmt?: (v: number) => string
  hint?: string
}

const COLUMNS: Column[] = [
  { key: 'matches', label: 'Матчи' },
  { key: 'winrate', label: 'WIN%', fmt: (v) => `${v}%` },
  { key: 'kd', label: 'K/D', fmt: (v) => v.toFixed(2) },
  { key: 'kr', label: 'K/R', fmt: (v) => v.toFixed(2) },
  { key: 'adr', label: 'ADR', fmt: (v) => v.toFixed(1) },
  { key: 'hsPct', label: 'HS%', fmt: (v) => `${v.toFixed(1)}%` },
  { key: 'kills', label: 'Килы' },
  { key: 'mvps', label: 'MVP' },
  { key: 'rating', label: 'RATING', fmt: (v) => v.toFixed(2) },
]

const FLAG: Record<string, string> = {
  ru: '🇷🇺', ua: '🇺🇦', by: '🇧🇾', kz: '🇰🇿', ee: '🇪🇪', lv: '🇱🇻',
}

// Человекочитаемое имя карты из mapName вида "de_dust2"
function prettyMap(map: string): string {
  const cleaned = map.replace(/^de_/i, '').replace(/^cs_/i, '')
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

export function Leaderboard({ map }: { map?: string } = {}) {
  // Базовый порог: на общем лидерборде показываем игроков от 10 матчей,
  // на странице конкретной карты порога нет (иначе редкие карты опустеют).
  // Авторитетный фильтр — на бэкенде (env LEADERBOARD_MIN_MATCHES); здесь дефолт UI.
  const minFloor = typeof map === 'string' ? 0 : 10
  const [sortKey, setSortKey] = useState<SortKey>('rating')
  const [asc, setAsc] = useState(false)
  const [query, setQuery] = useState('')
  const [minMatches, setMinMatches] = useState(minFloor)
  const [data, setData] = useState<PlayerRow[]>([])
  const [live, setLive] = useState(false)
  const [loading, setLoading] = useState(true)

  // Режим страницы карты: map зафиксирован пропом и дропдаун не показываем.
  const fixedMap = typeof map === 'string'
  // Выбор карты из дропдауна на главной (пусто = «Все карты»).
  const [selectedMap, setSelectedMap] = useState('')
  const [maps, setMaps] = useState<MapRow[]>([])

  const activeMap = fixedMap ? map : selectedMap

  useEffect(() => {
    if (fixedMap) return
    let cancelled = false
    fetchMaps().then((rows) => {
      if (!cancelled) setMaps(rows.slice().sort((a, b) => b.matches - a.matches))
    })
    return () => {
      cancelled = true
    }
  }, [fixedMap])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchLeaderboard(activeMap ? { map: activeMap } : undefined).then((r) => {
      if (cancelled) return
      setData(r.rows)
      setLive(r.live)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [activeMap])

  const rows = useMemo(() => {
    const filtered = data.filter(
      (p) =>
        p.nickname.toLowerCase().includes(query.toLowerCase().trim()) &&
        p.matches >= minMatches,
    )
    const sorted = [...filtered].sort((a, b) => {
      const d = (a[sortKey] as number) - (b[sortKey] as number)
      return asc ? d : -d
    })
    return sorted
  }, [data, sortKey, asc, query, minMatches])

  function toggleSort(key: SortKey) {
    if (key === sortKey) setAsc((v) => !v)
    else {
      setSortKey(key)
      setAsc(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* фильтры */}
      <div className="flex flex-wrap items-center gap-3">
        {!fixedMap && (
          <select
            value={selectedMap}
            onChange={(e) => setSelectedMap(e.target.value)}
            className="rounded-lg border border-neon-purple/50 bg-bg-soft/80 px-4 py-2 text-sm text-text outline-none focus:border-neon-cyan focus:shadow-neon-cyan"
          >
            <option value="">Все карты</option>
            {maps.map((m) => (
              <option key={m.map} value={m.map}>
                {prettyMap(m.map)}
              </option>
            ))}
          </select>
        )}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по нику…"
          className="w-56 rounded-lg border border-neon-purple/50 bg-bg-soft/80 px-4 py-2 text-sm text-text placeholder:text-text-dim/60 outline-none focus:border-neon-magenta focus:shadow-neon-magenta"
        />
        <label className="flex items-center gap-2 text-sm text-text-dim">
          Мин. матчей
          <input
            type="number"
            min={minFloor}
            value={minMatches}
            onChange={(e) => setMinMatches(Math.max(minFloor, Number(e.target.value) || 0))}
            className="w-20 rounded-lg border border-neon-purple/50 bg-bg-soft/80 px-3 py-2 text-sm text-text outline-none focus:border-neon-cyan focus:shadow-neon-cyan"
          />
        </label>
        <span className="ml-auto flex items-center gap-3 text-sm text-text-dim">
          {!loading && (
            <span
              className={`rounded-md border px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
                live
                  ? 'border-neon-cyan/70 text-neon-cyan neon-text-cyan'
                  : 'border-neon-magenta/60 text-neon-magenta'
              }`}
            >
              {live ? '● LIVE' : 'DEMO'}
            </span>
          )}
          Игроков: <span className="text-neon-cyan neon-text-cyan">{rows.length}</span>
        </span>
      </div>

      <NeonCard color="purple" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-text-dim">
                <Th className="w-14 text-center">#</Th>
                <Th className="text-left">Игрок</Th>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => toggleSort(c.key)}
                    className="cursor-pointer select-none whitespace-nowrap px-3 py-3 text-right font-display text-xs uppercase tracking-wider transition hover:text-neon-magenta"
                  >
                    {c.label}
                    <span className="ml-1 inline-block w-2 text-neon-magenta">
                      {sortKey === c.key ? (asc ? '▲' : '▼') : ''}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <tr
                  key={p.id}
                  className="group border-t border-neon-purple/15 transition hover:bg-neon-purple/10"
                >
                  <td className="px-3 py-3 text-center">
                    <RankBadge rank={i + 1} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full border border-neon-magenta/50 bg-bg-elev font-display text-xs text-neon-magenta">
                        {p.nickname.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <Link
                          to={`/players/${p.id}`}
                          className="font-semibold text-text transition hover:text-neon-magenta hover:neon-text-magenta group-hover:text-neon-magenta"
                        >
                          {p.nickname}
                        </Link>
                        <div className="text-xs text-text-dim">
                          {FLAG[p.country] ?? '🏳️'} {p.wins}W / {p.matches - p.wins}L
                        </div>
                      </div>
                    </div>
                  </td>
                  {COLUMNS.map((c) => {
                    const v = p[c.key] as number
                    const isRating = c.key === 'rating'
                    return (
                      <td
                        key={c.key}
                        className={`whitespace-nowrap px-3 py-3 text-right tabular-nums ${
                          isRating ? 'font-display font-bold text-neon-cyan neon-text-cyan' : 'text-text'
                        }`}
                      >
                        {c.fmt ? c.fmt(v) : v}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </NeonCard>
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-3 font-display text-xs uppercase tracking-wider ${className}`}>
      {children}
    </th>
  )
}

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    const color =
      rank === 1
        ? 'text-neon-magenta neon-text-magenta'
        : rank === 2
          ? 'text-neon-purple'
          : 'text-neon-cyan neon-text-cyan'
    return <span className={`font-display text-lg font-black ${color}`}>{rank}</span>
  }
  return <span className="text-text-dim">{rank}</span>
}
