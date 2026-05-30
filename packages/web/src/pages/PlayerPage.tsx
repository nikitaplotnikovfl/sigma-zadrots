import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { NeonCard, NeonChip } from '../components/Neon'

type NeonColor = 'magenta' | 'purple' | 'cyan'

type Player = {
  id: string
  nickname: string
  avatar: string | null
  country: string | null
  faceitUrl: string | null
}

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
  tripleKills: number
  quadroKills: number
  pentaKills: number
  rating: number
}

type HistoryItem = {
  matchId: string
  map: string
  won: boolean
  kills: number
  deaths: number
  assists: number
  kd: number
  kr: number
  adr: number
  hsPct: number
  finishedAt: string
}

type FormItem = {
  matchId: string
  mapName: string
  won: boolean
  kd: number
  adr: number
  finishedAt: string
}

type Streak = { type: 'W' | 'L'; count: number } | null

type MultiKills = { double?: number; triple: number; quadro: number; penta: number }

type Extended = {
  rounds: number
  perMatch: { kills: number; deaths: number; assists: number }
  kpr: number
  dpr: number
  mvpRate: number
  multiKills: { double: number; triple: number; quadro: number; penta: number }
  multiKillFrags: number
  consistency: { stdev: number; score: number }
}

type MapBreakdown = {
  map: string
  matches: number
  wins: number
  winrate: number
  kd: number
  adr: number
  hsPct: number
}

type PlayerResponse = {
  player: Player
  aggregate: Aggregate | null
  history: HistoryItem[]
  // Новые поля аналитики (могут отсутствовать пока бэкенд не задеплоен)
  form?: FormItem[]
  streak?: Streak
  peakRating?: number
  multiKills?: MultiKills
  extended?: Extended | null
  maps?: MapBreakdown[]
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

type LoadState =
  | { status: 'loading' }
  | { status: 'notfound' }
  | { status: 'error' }
  | { status: 'ready'; data: PlayerResponse }

// Двухбуквенный код страны -> emoji-флаг (regional indicator symbols)
function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return '🏳️'
  const cc = code.toUpperCase()
  if (!/^[A-Z]{2}$/.test(cc)) return '🏳️'
  const base = 0x1f1e6
  return String.fromCodePoint(
    base + (cc.charCodeAt(0) - 65),
    base + (cc.charCodeAt(1) - 65),
  )
}

function initials(nickname: string): string {
  return nickname.slice(0, 2).toUpperCase()
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

// ---- KPI ----

type Kpi = {
  label: string
  value: string
  color: 'magenta' | 'purple' | 'cyan'
}

function buildKpis(agg: Aggregate): Kpi[] {
  return [
    { label: 'Матчи', value: String(agg.matches), color: 'purple' },
    { label: 'Винрейт', value: `${agg.winrate.toFixed(0)}%`, color: 'cyan' },
    { label: 'K/D', value: agg.kd.toFixed(2), color: 'magenta' },
    { label: 'K/R', value: agg.kr.toFixed(2), color: 'purple' },
    { label: 'ADR', value: agg.adr.toFixed(1), color: 'cyan' },
    { label: 'HS%', value: `${agg.hsPct.toFixed(1)}%`, color: 'magenta' },
    { label: 'Rating', value: agg.rating.toFixed(2), color: 'cyan' },
    { label: 'MVP', value: String(agg.mvps), color: 'purple' },
  ]
}

const KPI_TEXT: Record<Kpi['color'], string> = {
  magenta: 'text-neon-magenta neon-text-magenta',
  purple: 'text-neon-purple',
  cyan: 'text-neon-cyan neon-text-cyan',
}

function KpiTile({ kpi }: { kpi: Kpi }) {
  return (
    <NeonCard color={kpi.color} className="px-4 py-4">
      <div className="font-display text-xs uppercase tracking-[0.2em] text-text-dim">
        {kpi.label}
      </div>
      <div
        className={`mt-2 font-display text-2xl font-black tabular-nums sm:text-3xl ${KPI_TEXT[kpi.color]}`}
      >
        {kpi.value}
      </div>
    </NeonCard>
  )
}

// ---- График ----

type Metric = 'kd' | 'adr' | 'hsPct'

const METRICS: { key: Metric; label: string }[] = [
  { key: 'kd', label: 'K/D' },
  { key: 'adr', label: 'ADR' },
  { key: 'hsPct', label: 'HS%' },
]

function formatMetric(metric: Metric, v: number): string {
  if (metric === 'kd') return v.toFixed(2)
  if (metric === 'adr') return v.toFixed(0)
  return `${v.toFixed(0)}%`
}

function MetricChart({
  points,
  metric,
}: {
  points: { value: number; won: boolean }[]
  metric: Metric
}) {
  // SVG viewBox-координаты, масштабируется по контейнеру
  const W = 720
  const H = 240
  const padX = 36
  const padY = 28

  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  // небольшой запас сверху/снизу
  const lo = min - span * 0.1
  const hi = max + span * 0.1
  const range = hi - lo || 1

  const innerW = W - padX * 2
  const innerH = H - padY * 2

  const xFor = (i: number) =>
    points.length === 1
      ? W / 2
      : padX + (innerW * i) / (points.length - 1)
  const yFor = (v: number) => padY + innerH * (1 - (v - lo) / range)

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(p.value).toFixed(1)}`)
    .join(' ')

  // 4 горизонтальные линии сетки
  const gridRows = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Динамика по матчам"
      >
        <defs>
          <filter id="player-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="player-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#b026ff" />
            <stop offset="100%" stopColor="#2de2ff" />
          </linearGradient>
        </defs>

        {/* сетка */}
        {gridRows.map((r) => {
          const y = padY + innerH * r
          const val = hi - range * r
          return (
            <g key={r}>
              <line
                x1={padX}
                y1={y}
                x2={W - padX}
                y2={y}
                stroke="rgba(176,38,255,0.18)"
                strokeWidth={1}
              />
              <text
                x={padX - 8}
                y={y + 4}
                textAnchor="end"
                fontSize={11}
                fill="rgba(185,169,214,0.7)"
                fontFamily="monospace"
              >
                {formatMetric(metric, val)}
              </text>
            </g>
          )
        })}

        {/* неоновая линия со свечением */}
        <path
          d={linePath}
          fill="none"
          stroke="url(#player-line)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#player-glow)"
        />

        {/* точки матчей: цвет по результату */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={xFor(i)}
            cy={yFor(p.value)}
            r={4}
            fill={p.won ? '#2de2ff' : '#ff2bd6'}
            stroke="#070310"
            strokeWidth={1.5}
            filter="url(#player-glow)"
          >
            <title>{formatMetric(metric, p.value)}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-2 flex items-center gap-4 px-1 text-xs text-text-dim">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-neon-cyan shadow-neon-cyan" />
          Победа
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-neon-magenta shadow-neon-magenta" />
          Поражение
        </span>
        <span className="ml-auto font-display uppercase tracking-[0.15em]">
          слева — старые, справа — свежие
        </span>
      </div>
    </div>
  )
}

// ---- Состояния ----

function CenterCard({
  children,
  color = 'purple',
}: {
  children: React.ReactNode
  color?: 'magenta' | 'purple' | 'cyan'
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <NeonCard color={color} className="px-8 py-12 text-center">
        {children}
      </NeonCard>
    </div>
  )
}

function LoadingView() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <NeonCard color="purple" className="flex items-center gap-5 px-6 py-6">
        <div className="h-20 w-20 animate-pulse rounded-full border border-neon-purple/40 bg-bg-elev" />
        <div className="flex-1 space-y-3">
          <div className="h-6 w-48 animate-pulse rounded bg-bg-elev" />
          <div className="h-4 w-32 animate-pulse rounded bg-bg-elev" />
        </div>
      </NeonCard>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <NeonCard key={i} color="purple" className="px-4 py-6">
            <div className="h-3 w-16 animate-pulse rounded bg-bg-elev" />
            <div className="mt-3 h-7 w-20 animate-pulse rounded bg-bg-elev" />
          </NeonCard>
        ))}
      </div>
      <NeonCard color="cyan" className="px-6 py-16">
        <div className="flex items-center justify-center gap-3 text-neon-cyan neon-text-cyan">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-neon-cyan/30 border-t-neon-cyan" />
          <span className="font-display uppercase tracking-[0.25em]">Загрузка…</span>
        </div>
      </NeonCard>
    </div>
  )
}

function NotFoundView() {
  return (
    <CenterCard color="magenta">
      <div className="font-display text-6xl font-black text-neon-magenta neon-text-magenta">
        404
      </div>
      <div className="mt-4 font-display text-xl uppercase tracking-[0.2em] text-text">
        Игрок не найден
      </div>
      <p className="mt-3 text-text-dim">
        Похоже, такого задрота в базе ещё нет. Возможно, хаб ещё не опубликован
        или ссылка устарела.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex rounded-xl border border-neon-cyan/70 bg-bg-soft/70 px-5 py-2 font-display text-sm uppercase tracking-[0.2em] text-neon-cyan neon-text-cyan transition hover:shadow-neon-cyan"
      >
        ← К лидерборду
      </Link>
    </CenterCard>
  )
}

function ErrorView({ onRetry }: { onRetry: () => void }) {
  return (
    <CenterCard color="magenta">
      <div className="font-display text-2xl uppercase tracking-[0.2em] text-neon-magenta neon-text-magenta">
        Ошибка соединения
      </div>
      <p className="mt-3 text-text-dim">
        Не удалось загрузить данные игрока. Проверь соединение и попробуй снова.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 inline-flex rounded-xl border border-neon-cyan/70 bg-bg-soft/70 px-5 py-2 font-display text-sm uppercase tracking-[0.2em] text-neon-cyan neon-text-cyan transition hover:shadow-neon-cyan"
      >
        Повторить
      </button>
    </CenterCard>
  )
}

// ---- Шапка ----

function PlayerHeader({ player }: { player: Player }) {
  return (
    <NeonCard color="magenta" className="flex flex-wrap items-center gap-5 px-6 py-6">
      {player.avatar ? (
        <img
          src={player.avatar}
          alt={player.nickname}
          className="h-20 w-20 rounded-full border border-neon-magenta/70 object-cover shadow-neon-magenta"
        />
      ) : (
        <div className="grid h-20 w-20 place-items-center rounded-full border border-neon-magenta/70 bg-bg-elev font-display text-2xl font-black text-neon-magenta neon-text-magenta shadow-neon-magenta">
          {initials(player.nickname)}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <h1 className="truncate font-display text-3xl font-black uppercase tracking-[0.12em] text-text sm:text-4xl">
            {player.nickname}
          </h1>
          <span className="text-3xl leading-none" title={player.country ?? undefined}>
            {countryFlag(player.country)}
          </span>
        </div>
        {player.faceitUrl && (
          <a
            href={player.faceitUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-sm text-neon-cyan neon-text-cyan transition hover:underline"
          >
            FACEIT профиль ↗
          </a>
        )}
      </div>
    </NeonCard>
  )
}

// ---- История ----

const HISTORY_COLS = [
  { label: 'Карта', align: 'text-left' as const },
  { label: 'Рез.', align: 'text-center' as const },
  { label: 'K-D-A', align: 'text-right' as const },
  { label: 'K/D', align: 'text-right' as const },
  { label: 'ADR', align: 'text-right' as const },
  { label: 'HS%', align: 'text-right' as const },
  { label: 'Дата', align: 'text-right' as const },
]

function HistoryTable({ history }: { history: HistoryItem[] }) {
  return (
    <NeonCard color="purple" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-text-dim">
              {HISTORY_COLS.map((c) => (
                <th
                  key={c.label}
                  className={`whitespace-nowrap px-3 py-3 font-display text-xs uppercase tracking-wider ${c.align}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr
                key={h.matchId}
                className="border-t border-neon-purple/15 transition hover:bg-neon-purple/10"
              >
                <td className="whitespace-nowrap px-3 py-3 font-semibold text-text">
                  {h.map}
                </td>
                <td className="px-3 py-3 text-center">
                  <span
                    className={`inline-flex rounded-md border px-2 py-0.5 font-display text-xs font-bold uppercase tracking-wider ${
                      h.won
                        ? 'border-neon-cyan/70 text-neon-cyan neon-text-cyan'
                        : 'border-neon-magenta/60 text-neon-magenta'
                    }`}
                  >
                    {h.won ? 'W' : 'L'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-text">
                  {h.kills}-{h.deaths}-{h.assists}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-text">
                  {h.kd.toFixed(2)}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-text">
                  {h.adr.toFixed(1)}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-text">
                  {h.hsPct.toFixed(1)}%
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-text-dim">
                  {fmtDate(h.finishedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </NeonCard>
  )
}

// ---- Форма / стрик / пик рейтинга ----

function FormBlock({
  form,
  streak,
  peakRating,
  currentRating,
}: {
  form: FormItem[]
  streak: Streak
  peakRating: number | undefined
  currentRating: number | undefined
}) {
  // form: свежие первыми -> для полоски показываем слева старые, справа свежие
  const cells = [...form].reverse()

  return (
    <NeonCard color="cyan" className="px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        {/* Полоска последних матчей */}
        <div className="min-w-0 flex-1">
          <div className="font-display text-xs uppercase tracking-[0.2em] text-text-dim">
            Последние матчи
          </div>
          {cells.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {cells.map((f) => (
                <span
                  key={f.matchId}
                  title={`${f.mapName} · K/D ${num(f.kd).toFixed(2)} · ADR ${num(f.adr).toFixed(0)} · ${fmtDate(f.finishedAt)}`}
                  className={`grid h-8 w-8 place-items-center rounded-md border font-display text-sm font-black ${
                    f.won
                      ? 'border-neon-cyan/70 text-neon-cyan neon-text-cyan shadow-neon-cyan'
                      : 'border-neon-magenta/70 text-neon-magenta neon-text-magenta shadow-neon-magenta'
                  }`}
                >
                  {f.won ? 'W' : 'L'}
                </span>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-sm text-text-dim">Нет данных о форме.</div>
          )}
        </div>

        {/* Текущий стрик */}
        <div>
          <div className="font-display text-xs uppercase tracking-[0.2em] text-text-dim">
            Серия
          </div>
          {streak && streak.count > 0 ? (
            <div
              className={`mt-2 font-display text-2xl font-black tabular-nums ${
                streak.type === 'W'
                  ? 'text-neon-cyan neon-text-cyan'
                  : 'text-neon-magenta neon-text-magenta'
              }`}
            >
              {streak.type}×{streak.count}
            </div>
          ) : (
            <div className="mt-2 font-display text-2xl font-black text-text-dim">—</div>
          )}
        </div>

        {/* Пик рейтинга рядом с текущим */}
        <div>
          <div className="font-display text-xs uppercase tracking-[0.2em] text-text-dim">
            Пик / тек. рейтинг
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-black tabular-nums text-neon-purple">
              {peakRating != null ? num(peakRating).toFixed(2) : '—'}
            </span>
            <span className="font-display text-lg font-bold tabular-nums text-text-dim">
              / {currentRating != null ? num(currentRating).toFixed(2) : '—'}
            </span>
          </div>
        </div>
      </div>
    </NeonCard>
  )
}

// ---- Мультикиллы ----

function MultiKillTiles({ mk }: { mk: MultiKills }) {
  const tiles: { label: string; value: number; color: NeonColor }[] = [
    { label: '3K (Triple)', value: num(mk.triple), color: 'cyan' },
    { label: '4K (Quadro)', value: num(mk.quadro), color: 'purple' },
    { label: '5K (Ace)', value: num(mk.penta), color: 'magenta' },
  ]
  return (
    <div className="grid grid-cols-3 gap-3">
      {tiles.map((t) => (
        <NeonCard key={t.label} color={t.color} className="px-4 py-4 text-center">
          <div className="font-display text-xs uppercase tracking-[0.18em] text-text-dim">
            {t.label}
          </div>
          <div
            className={`mt-2 font-display text-3xl font-black tabular-nums sm:text-4xl ${KPI_TEXT[t.color]}`}
          >
            {t.value}
          </div>
        </NeonCard>
      ))}
    </div>
  )
}

// ---- Разбивка по картам ----

const MAP_COLS = [
  { label: 'Карта', align: 'text-left' as const },
  { label: 'Матчи', align: 'text-right' as const },
  { label: 'Винрейт', align: 'text-right' as const },
  { label: 'K/D', align: 'text-right' as const },
  { label: 'ADR', align: 'text-right' as const },
  { label: 'HS%', align: 'text-right' as const },
]

function MapsTable({ maps }: { maps: MapBreakdown[] }) {
  // сортировка по matches desc (на случай если бэкенд не отсортировал)
  const sorted = [...maps].sort((a, b) => num(b.matches) - num(a.matches))
  return (
    <NeonCard color="cyan" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-text-dim">
              {MAP_COLS.map((c) => (
                <th
                  key={c.label}
                  className={`whitespace-nowrap px-3 py-3 font-display text-xs uppercase tracking-wider ${c.align}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr
                key={m.map}
                className="border-t border-neon-cyan/15 transition hover:bg-neon-cyan/10"
              >
                <td className="whitespace-nowrap px-3 py-3 font-semibold text-text">
                  {m.map}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-text">
                  {num(m.matches)}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-text">
                  {num(m.winrate).toFixed(0)}%
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-text">
                  {num(m.kd).toFixed(2)}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-text">
                  {num(m.adr).toFixed(1)}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-text">
                  {num(m.hsPct).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </NeonCard>
  )
}

// ---- Шаринг-карточка ----

function svgEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildShareSvg(player: Player, agg: Aggregate | null): string {
  const W = 1200
  const H = 630
  const flag = countryFlag(player.country)
  const nick = svgEscape(player.nickname)

  const kpis: { label: string; value: string }[] = [
    { label: 'RATING', value: agg ? num(agg.rating).toFixed(2) : '—' },
    { label: 'K/D', value: agg ? num(agg.kd).toFixed(2) : '—' },
    { label: 'ADR', value: agg ? num(agg.adr).toFixed(1) : '—' },
    { label: 'WINRATE', value: agg ? `${num(agg.winrate).toFixed(0)}%` : '—' },
    { label: 'MATCHES', value: agg ? String(num(agg.matches)) : '—' },
  ]

  const colCount = kpis.length
  const gap = 28
  const marginX = 80
  const tileW = (W - marginX * 2 - gap * (colCount - 1)) / colCount
  const tileH = 150
  const tileY = 360

  const tilesSvg = kpis
    .map((k, i) => {
      const x = marginX + i * (tileW + gap)
      const cx = x + tileW / 2
      return `
    <rect x="${x.toFixed(1)}" y="${tileY}" width="${tileW.toFixed(1)}" height="${tileH}" rx="18"
          fill="#120822" stroke="url(#edge)" stroke-width="2" filter="url(#soft)"/>
    <text x="${cx.toFixed(1)}" y="${tileY + 60}" text-anchor="middle"
          font-family="Orbitron, Arial, sans-serif" font-size="26" letter-spacing="4"
          fill="#b9a9d6">${k.label}</text>
    <text x="${cx.toFixed(1)}" y="${tileY + 118}" text-anchor="middle"
          font-family="Orbitron, Arial, sans-serif" font-weight="900" font-size="54"
          fill="#2de2ff" filter="url(#glow)">${svgEscape(k.value)}</text>`
    })
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0414"/>
      <stop offset="100%" stop-color="#15071f"/>
    </linearGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#b026ff"/>
      <stop offset="100%" stop-color="#2de2ff"/>
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="20" y="20" width="${W - 40}" height="${H - 40}" rx="28"
        fill="none" stroke="url(#edge)" stroke-width="3" filter="url(#soft)"/>

  <text x="${marginX}" y="100" font-family="Orbitron, Arial, sans-serif" font-weight="900"
        font-size="40" letter-spacing="6" fill="#ff2bd6" filter="url(#glow)">SIGMA</text>
  <text x="${marginX + 230}" y="100" font-family="Orbitron, Arial, sans-serif" font-weight="700"
        font-size="40" letter-spacing="14" fill="#2de2ff" filter="url(#glow)">ZADROTS</text>

  <text x="${marginX}" y="250" font-family="Orbitron, Arial, sans-serif" font-weight="900"
        font-size="92" fill="#f4ecff" filter="url(#glow)">${nick}</text>
  <text x="${marginX}" y="320" font-family="Arial, sans-serif" font-size="44"
        fill="#b9a9d6">${svgEscape(flag)} ${svgEscape(player.country ?? '')}</text>

  ${tilesSvg}
</svg>`
}

function ShareButtons({
  player,
  aggregate,
}: {
  player: Player
  aggregate: Aggregate | null
}) {
  const [copied, setCopied] = useState(false)

  const handleShare = () => {
    try {
      const svg = buildShareSvg(player, aggregate)
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const safe = player.nickname.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'player'
      a.download = `sigma-zadrots-${safe}.svg`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      /* мягко игнорируем сбои генерации/скачивания */
    }
  }

  const handleCopy = () => {
    const link =
      typeof window !== 'undefined' ? window.location.href : ''
    const done = () => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    }
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(link).then(done).catch(() => undefined)
      }
    } catch {
      /* clipboard недоступен — мягко игнорируем */
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={handleShare}
        className="inline-flex items-center gap-2 rounded-xl border border-neon-magenta/70 bg-bg-soft/70 px-5 py-2 font-display text-sm font-bold uppercase tracking-[0.2em] text-neon-magenta neon-text-magenta transition hover:shadow-neon-magenta"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="8 8 12 4 16 8" />
          <line x1="12" y1="4" x2="12" y2="16" />
        </svg>
        Поделиться
      </button>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-2 rounded-xl border border-neon-cyan/70 bg-bg-soft/70 px-5 py-2 font-display text-sm font-bold uppercase tracking-[0.2em] text-neon-cyan neon-text-cyan transition hover:shadow-neon-cyan"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        {copied ? 'Скопировано!' : 'Скопировать ссылку'}
      </button>
    </div>
  )
}

// ---- Главный компонент ----

export function PlayerPage() {
  const { id } = useParams<{ id: string }>()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [metric, setMetric] = useState<Metric>('kd')

  useEffect(() => {
    if (!id) {
      setState({ status: 'notfound' })
      return
    }
    let cancelled = false
    setState({ status: 'loading' })

    fetch(`/api/players/${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (res.status === 404) {
          if (!cancelled) setState({ status: 'notfound' })
          return
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as PlayerResponse
        if (!cancelled) setState({ status: 'ready', data })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })

    return () => {
      cancelled = true
    }
  }, [id])

  // история: бэкенд отдаёт свежие первыми -> разворачиваем в хронологию
  const chronological = useMemo(() => {
    if (state.status !== 'ready') return []
    return [...state.data.history].reverse()
  }, [state])

  const chartPoints = useMemo(
    () =>
      chronological.map((h) => ({
        value: h[metric],
        won: h.won,
      })),
    [chronological, metric],
  )

  if (state.status === 'loading') return <LoadingView />
  if (state.status === 'notfound') return <NotFoundView />
  if (state.status === 'error')
    return <ErrorView onRetry={() => setState({ status: 'loading' })} />

  const { player, aggregate, history } = state.data
  const form = state.data.form ?? []
  const streak = state.data.streak ?? null
  const peakRating = state.data.peakRating
  const multiKills = state.data.multiKills
  const maps = state.data.maps ?? []

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <PlayerHeader player={player} />

      {/* Шаринг */}
      <ShareButtons player={player} aggregate={aggregate} />

      {/* Форма / стрик / пик рейтинга */}
      <section className="space-y-4">
        <NeonChip color="cyan">Форма</NeonChip>
        <FormBlock
          form={form}
          streak={streak}
          peakRating={peakRating ?? aggregate?.rating}
          currentRating={aggregate?.rating}
        />
      </section>

      {/* KPI */}
      <section className="space-y-4">
        <NeonChip color="cyan">Статистика</NeonChip>
        {aggregate ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {buildKpis(aggregate).map((kpi) => (
              <KpiTile key={kpi.label} kpi={kpi} />
            ))}
          </div>
        ) : (
          <NeonCard color="purple" className="px-6 py-10 text-center text-text-dim">
            Пока нет агрегированной статистики по этому игроку.
          </NeonCard>
        )}
      </section>

      {/* Мультикиллы */}
      <section className="space-y-4">
        <NeonChip color="magenta">Мультикиллы</NeonChip>
        {multiKills ? (
          <MultiKillTiles mk={multiKills} />
        ) : aggregate ? (
          <MultiKillTiles
            mk={{
              triple: aggregate.tripleKills,
              quadro: aggregate.quadroKills,
              penta: aggregate.pentaKills,
            }}
          />
        ) : (
          <NeonCard color="purple" className="px-6 py-10 text-center text-text-dim">
            Нет данных о мультикиллах.
          </NeonCard>
        )}
      </section>

      {/* По картам */}
      <section className="space-y-4">
        <NeonChip color="cyan">По картам</NeonChip>
        {maps.length > 0 ? (
          <MapsTable maps={maps} />
        ) : (
          <NeonCard color="purple" className="px-6 py-10 text-center text-text-dim">
            Нет разбивки по картам.
          </NeonCard>
        )}
      </section>

      {/* График динамики */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <NeonChip color="magenta">Динамика</NeonChip>
          <div className="flex flex-wrap gap-2">
            {METRICS.map((m) => {
              const active = m.key === metric
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMetric(m.key)}
                  className={`rounded-xl border px-4 py-1.5 font-display text-xs font-bold uppercase tracking-[0.2em] transition ${
                    active
                      ? 'border-neon-cyan/80 text-neon-cyan neon-text-cyan shadow-neon-cyan'
                      : 'border-neon-purple/40 text-text-dim hover:text-text'
                  }`}
                >
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>
        <NeonCard color="cyan" className="px-4 py-5 sm:px-6">
          {chartPoints.length > 0 ? (
            <MetricChart points={chartPoints} metric={metric} />
          ) : (
            <div className="py-10 text-center text-text-dim">
              Нет матчей для построения графика.
            </div>
          )}
        </NeonCard>
      </section>

      {/* История матчей */}
      <section className="space-y-4">
        <NeonChip color="purple">История матчей</NeonChip>
        {history.length > 0 ? (
          <HistoryTable history={history} />
        ) : (
          <NeonCard color="purple" className="px-6 py-10 text-center text-text-dim">
            История матчей пуста.
          </NeonCard>
        )}
      </section>
    </div>
  )
}

export default PlayerPage
