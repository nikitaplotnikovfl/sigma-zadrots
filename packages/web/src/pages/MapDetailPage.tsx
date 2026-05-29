import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchMaps, type MapRow } from '../api'
import { Leaderboard } from '../components/Leaderboard'
import { NeonCard, NeonChip } from '../components/Neon'

// Человекочитаемое имя карты из mapName вида "de_dust2"
function prettyMap(map: string): string {
  const cleaned = map.replace(/^de_/i, '').replace(/^cs_/i, '')
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; info: MapRow | null }

const STATS: {
  key: keyof Omit<MapRow, 'map'>
  label: string
  fmt: (v: number) => string
}[] = [
  { key: 'matches', label: 'Матчей', fmt: (v) => String(v) },
  { key: 'avgKills', label: 'Ср. килы', fmt: (v) => v.toFixed(1) },
  { key: 'avgAdr', label: 'Ср. ADR', fmt: (v) => v.toFixed(1) },
  { key: 'avgHsPct', label: 'Ср. HS%', fmt: (v) => `${v.toFixed(1)}%` },
  { key: 'avgKd', label: 'Ср. K/D', fmt: (v) => v.toFixed(2) },
]

export default function MapDetailPage() {
  const { map = '' } = useParams<{ map: string }>()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    fetchMaps().then((rows) => {
      if (cancelled) return
      const info = rows.find((m) => m.map === map) ?? null
      setState({ status: 'ready', info })
    })
    return () => {
      cancelled = true
    }
  }, [map])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl border border-neon-cyan/50 bg-bg-elev text-2xl">
            🗺️
          </span>
          <div>
            <NeonChip color="cyan">{prettyMap(map)}</NeonChip>
            <div className="mt-1 font-display text-xs uppercase tracking-wider text-text-dim">
              {map}
            </div>
          </div>
        </div>
        <Link
          to="/maps"
          className="font-display text-xs uppercase tracking-wider text-text-dim transition hover:text-neon-magenta hover:neon-text-magenta"
        >
          ← Все карты
        </Link>
      </div>

      {state.status === 'loading' && (
        <NeonCard color="cyan" className="px-6 py-12 text-center">
          <p className="animate-pulse-glow font-display text-lg uppercase tracking-[0.2em] text-neon-cyan neon-text-cyan">
            Загрузка…
          </p>
        </NeonCard>
      )}

      {state.status === 'ready' && (
        <>
          {state.info ? (
            <NeonCard color="purple" className="px-6 py-5">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                {STATS.map((s) => (
                  <div key={s.key} className="text-center">
                    <div className="font-display text-xs uppercase tracking-wider text-text-dim">
                      {s.label}
                    </div>
                    <div className="mt-1 font-display text-xl font-bold tabular-nums text-neon-cyan neon-text-cyan">
                      {state.info ? s.fmt(state.info[s.key]) : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </NeonCard>
          ) : (
            <NeonCard color="magenta" className="px-6 py-8 text-center">
              <p className="font-display text-sm uppercase tracking-[0.2em] text-text-dim">
                Сводной статистики по этой карте пока нет
              </p>
            </NeonCard>
          )}

          <Leaderboard map={map} />
        </>
      )}
    </div>
  )
}
