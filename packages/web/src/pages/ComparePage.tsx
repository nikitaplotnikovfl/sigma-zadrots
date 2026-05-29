import { useEffect, useMemo, useState } from 'react'
import { NeonCard, NeonChip } from '../components/Neon'

type Option = { playerId: string; nickname: string }

type Aggregate = {
  matches: number
  wins: number
  winrate: number
  kills: number
  deaths: number
  assists: number
  kd: number
  kr: number
  adr: number
  hsPct: number
  mvps: number
  rating: number
}

type PlayerResponse = {
  player: { id: string; nickname: string; avatar: string | null; country: string | null }
  aggregate: Aggregate | null
}

type Side = {
  nickname: string
  avatar: string | null
  aggregate: Aggregate | null
}

type Metric = {
  key: keyof Aggregate
  label: string
  fmt: (v: number) => string
  // true -> больше лучше, false -> меньше лучше (для нас всё «больше лучше»)
  higherIsBetter: boolean
}

const METRICS: Metric[] = [
  { key: 'matches', label: 'Матчи', fmt: (v) => String(v), higherIsBetter: true },
  { key: 'winrate', label: 'Винрейт', fmt: (v) => `${v.toFixed(0)}%`, higherIsBetter: true },
  { key: 'kd', label: 'K/D', fmt: (v) => v.toFixed(2), higherIsBetter: true },
  { key: 'kr', label: 'K/R', fmt: (v) => v.toFixed(2), higherIsBetter: true },
  { key: 'adr', label: 'ADR', fmt: (v) => v.toFixed(1), higherIsBetter: true },
  { key: 'hsPct', label: 'HS%', fmt: (v) => `${v.toFixed(1)}%`, higherIsBetter: true },
  { key: 'rating', label: 'Rating', fmt: (v) => v.toFixed(2), higherIsBetter: true },
  { key: 'mvps', label: 'MVP', fmt: (v) => String(v), higherIsBetter: true },
]

function initials(nickname: string): string {
  return nickname.slice(0, 2).toUpperCase()
}

export function ComparePage() {
  const [options, setOptions] = useState<Option[]>([])
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState(false)

  const [leftId, setLeftId] = useState('')
  const [rightId, setRightId] = useState('')

  const [left, setLeft] = useState<Side | null>(null)
  const [right, setRight] = useState<Side | null>(null)
  const [comparing, setComparing] = useState(false)
  const [compareError, setCompareError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setOptionsLoading(true)
    fetch('/api/leaderboard?pageSize=200')
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return (await r.json()) as { items: Array<{ playerId: string; nickname: string }> }
      })
      .then((data) => {
        if (cancelled) return
        const opts = (data.items ?? []).map((it) => ({
          playerId: it.playerId,
          nickname: it.nickname,
        }))
        setOptions(opts)
        setOptionsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setOptionsError(true)
        setOptionsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const bothSelected = leftId !== '' && rightId !== ''

  useEffect(() => {
    if (!bothSelected) {
      setLeft(null)
      setRight(null)
      return
    }
    let cancelled = false
    setComparing(true)
    setCompareError(false)

    const load = async (id: string): Promise<Side> => {
      const res = await fetch(`/api/players/${encodeURIComponent(id)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as PlayerResponse
      return {
        nickname: data.player.nickname,
        avatar: data.player.avatar,
        aggregate: data.aggregate,
      }
    }

    Promise.all([load(leftId), load(rightId)])
      .then(([l, r]) => {
        if (cancelled) return
        setLeft(l)
        setRight(r)
        setComparing(false)
      })
      .catch(() => {
        if (cancelled) return
        setCompareError(true)
        setComparing(false)
      })

    return () => {
      cancelled = true
    }
  }, [leftId, rightId, bothSelected])

  const rightOptions = useMemo(
    () => options.filter((o) => o.playerId !== leftId),
    [options, leftId],
  )
  const leftOptions = useMemo(
    () => options.filter((o) => o.playerId !== rightId),
    [options, rightId],
  )

  return (
    <div className="space-y-6">
      <NeonChip color="magenta">Сравнение</NeonChip>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PlayerSelect
          label="Игрок 1"
          color="magenta"
          value={leftId}
          onChange={setLeftId}
          options={leftOptions}
          disabled={optionsLoading || optionsError}
        />
        <PlayerSelect
          label="Игрок 2"
          color="cyan"
          value={rightId}
          onChange={setRightId}
          options={rightOptions}
          disabled={optionsLoading || optionsError}
        />
      </div>

      {optionsLoading && <InfoCard color="cyan">Загрузка списка игроков…</InfoCard>}
      {optionsError && (
        <InfoCard color="magenta">Не удалось загрузить список игроков.</InfoCard>
      )}

      {!optionsLoading && !optionsError && !bothSelected && (
        <InfoCard color="purple">
          Выберите двух игроков, чтобы сравнить их статистику.
        </InfoCard>
      )}

      {bothSelected && comparing && <InfoCard color="cyan">Загрузка статистики…</InfoCard>}
      {bothSelected && compareError && (
        <InfoCard color="magenta">Не удалось загрузить статистику игроков.</InfoCard>
      )}

      {bothSelected && !comparing && !compareError && left && right && (
        <CompareTable left={left} right={right} />
      )}
    </div>
  )
}

function PlayerSelect({
  label,
  color,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string
  color: 'magenta' | 'cyan'
  value: string
  onChange: (v: string) => void
  options: Option[]
  disabled: boolean
}) {
  const border =
    color === 'magenta'
      ? 'border-neon-magenta/60 focus:border-neon-magenta focus:shadow-neon-magenta'
      : 'border-neon-cyan/60 focus:border-neon-cyan focus:shadow-neon-cyan'
  const text =
    color === 'magenta'
      ? 'text-neon-magenta neon-text-magenta'
      : 'text-neon-cyan neon-text-cyan'
  return (
    <label className="block space-y-2">
      <span className={`font-display text-xs uppercase tracking-[0.2em] ${text}`}>
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border bg-bg-soft/80 px-4 py-3 text-sm text-text outline-none transition disabled:cursor-not-allowed disabled:opacity-40 ${border}`}
      >
        <option value="">— выберите игрока —</option>
        {options.map((o) => (
          <option key={o.playerId} value={o.playerId}>
            {o.nickname}
          </option>
        ))}
      </select>
    </label>
  )
}

function CompareTable({ left, right }: { left: Side; right: Side }) {
  return (
    <NeonCard color="purple" className="overflow-hidden">
      <div className="grid grid-cols-3 items-center gap-2 border-b border-neon-purple/15 px-4 py-5">
        <SideHeader side={left} color="magenta" align="left" />
        <div className="text-center font-display text-xs uppercase tracking-[0.2em] text-text-dim">
          vs
        </div>
        <SideHeader side={right} color="cyan" align="right" />
      </div>

      <div className="divide-y divide-neon-purple/10">
        {METRICS.map((m) => {
          const lv = left.aggregate ? left.aggregate[m.key] : null
          const rv = right.aggregate ? right.aggregate[m.key] : null
          let leftBest = false
          let rightBest = false
          if (lv != null && rv != null && lv !== rv) {
            const leftWins = m.higherIsBetter ? lv > rv : lv < rv
            leftBest = leftWins
            rightBest = !leftWins
          }
          return (
            <div key={m.key} className="grid grid-cols-3 items-center gap-2 px-4 py-3">
              <div
                className={`text-left font-display text-lg font-bold tabular-nums ${
                  leftBest ? 'text-neon-magenta neon-text-magenta' : 'text-text'
                }`}
              >
                {lv != null ? m.fmt(lv) : '—'}
              </div>
              <div className="text-center text-xs uppercase tracking-widest text-text-dim">
                {m.label}
              </div>
              <div
                className={`text-right font-display text-lg font-bold tabular-nums ${
                  rightBest ? 'text-neon-cyan neon-text-cyan' : 'text-text'
                }`}
              >
                {rv != null ? m.fmt(rv) : '—'}
              </div>
            </div>
          )
        })}
      </div>
    </NeonCard>
  )
}

function SideHeader({
  side,
  color,
  align,
}: {
  side: Side
  color: 'magenta' | 'cyan'
  align: 'left' | 'right'
}) {
  const ring =
    color === 'magenta'
      ? 'border-neon-magenta/70 text-neon-magenta neon-text-magenta shadow-neon-magenta'
      : 'border-neon-cyan/70 text-neon-cyan neon-text-cyan shadow-neon-cyan'
  const name =
    color === 'magenta'
      ? 'text-neon-magenta neon-text-magenta'
      : 'text-neon-cyan neon-text-cyan'
  return (
    <div
      className={`flex items-center gap-3 ${
        align === 'right' ? 'flex-row-reverse text-right' : 'text-left'
      }`}
    >
      {side.avatar ? (
        <img
          src={side.avatar}
          alt={side.nickname}
          className={`h-12 w-12 shrink-0 rounded-full border object-cover ${ring}`}
        />
      ) : (
        <div
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border bg-bg-elev font-display text-sm font-black ${ring}`}
        >
          {initials(side.nickname)}
        </div>
      )}
      <span className={`min-w-0 truncate font-display text-base font-bold uppercase tracking-wider ${name}`}>
        {side.nickname}
      </span>
    </div>
  )
}

function InfoCard({
  children,
  color,
}: {
  children: React.ReactNode
  color: 'magenta' | 'purple' | 'cyan'
}) {
  const text =
    color === 'magenta'
      ? 'text-neon-magenta neon-text-magenta'
      : color === 'cyan'
        ? 'text-neon-cyan neon-text-cyan'
        : 'text-text-dim'
  return (
    <NeonCard color={color} className="px-6 py-12 text-center">
      <p className={`font-display text-base uppercase tracking-[0.2em] ${text}`}>
        {children}
      </p>
    </NeonCard>
  )
}

export default ComparePage
