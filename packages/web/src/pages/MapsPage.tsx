import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { NeonCard, NeonChip } from '../components/Neon'

type MapRow = {
  map: string
  matches: number
  avgKills: number
  avgAdr: number
  avgHsPct: number
  avgKd: number
}

type MapsResponse = {
  items: MapRow[]
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; items: MapRow[] }

// Человекочитаемое имя карты из mapName вида "de_dust2"
function prettyMap(map: string): string {
  const cleaned = map.replace(/^de_/i, '').replace(/^cs_/i, '')
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

const COLUMNS: {
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

export function MapsPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    fetch('/api/maps')
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return (await r.json()) as MapsResponse
      })
      .then((data) => {
        if (cancelled) return
        const items = (data.items ?? [])
          .filter((it) => it.map && it.map.trim().length > 0)
          .slice()
          .sort((a, b) => b.matches - a.matches)
        setState({ status: 'ready', items })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <NeonChip color="cyan">Карты</NeonChip>
        {state.status === 'ready' && state.items.length > 0 && (
          <span className="font-display text-xs uppercase tracking-wider text-text-dim">
            Карт:{' '}
            <span className="tabular-nums text-neon-cyan neon-text-cyan">
              {state.items.length}
            </span>
          </span>
        )}
      </div>

      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorState />}
      {state.status === 'ready' && state.items.length === 0 && <EmptyState />}

      {state.status === 'ready' && state.items.length > 0 && (
        <MapsTable items={state.items} />
      )}
    </div>
  )
}

function MapsTable({ items }: { items: MapRow[] }) {
  return (
    <NeonCard color="purple" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-text-dim">
              <th className="px-4 py-3 text-left font-display text-xs uppercase tracking-wider">
                Карта
              </th>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className="whitespace-nowrap px-3 py-3 text-right font-display text-xs uppercase tracking-wider"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr
                key={m.map}
                className="group border-t border-neon-purple/15 transition hover:bg-neon-purple/10"
              >
                <td className="px-4 py-3">
                  <Link
                    to={`/maps/${encodeURIComponent(m.map)}`}
                    className="flex items-center gap-3"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-lg border border-neon-cyan/50 bg-bg-elev text-base">
                      🗺️
                    </span>
                    <div>
                      <div className="font-semibold text-text transition group-hover:text-neon-cyan group-hover:neon-text-cyan">
                        {prettyMap(m.map)}
                      </div>
                      <div className="text-xs text-text-dim">{m.map}</div>
                    </div>
                  </Link>
                </td>
                {COLUMNS.map((c) => {
                  const isMatches = c.key === 'matches'
                  return (
                    <td
                      key={c.key}
                      className={`whitespace-nowrap px-3 py-3 text-right tabular-nums ${
                        isMatches
                          ? 'font-display font-bold text-neon-magenta neon-text-magenta'
                          : 'text-text'
                      }`}
                    >
                      {c.fmt(m[c.key])}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </NeonCard>
  )
}

function LoadingState() {
  return (
    <NeonCard color="cyan" className="px-6 py-12 text-center">
      <p className="animate-pulse-glow font-display text-lg uppercase tracking-[0.2em] text-neon-cyan neon-text-cyan">
        Загрузка…
      </p>
    </NeonCard>
  )
}

function EmptyState() {
  return (
    <NeonCard color="purple" className="px-6 py-16 text-center">
      <p className="font-display text-xl uppercase tracking-[0.2em] text-text-dim">
        Карт пока нет
      </p>
      <p className="mt-2 text-sm text-text-dim/70">
        Как только сыграются матчи — статистика по картам появится здесь.
      </p>
    </NeonCard>
  )
}

function ErrorState() {
  return (
    <NeonCard color="magenta" className="px-6 py-16 text-center">
      <p className="font-display text-xl uppercase tracking-[0.2em] text-neon-magenta neon-text-magenta">
        Что-то пошло не так
      </p>
      <p className="mt-2 text-sm text-text-dim">
        Не удалось загрузить статистику по картам. Попробуйте обновить страницу позже.
      </p>
    </NeonCard>
  )
}

export default MapsPage
