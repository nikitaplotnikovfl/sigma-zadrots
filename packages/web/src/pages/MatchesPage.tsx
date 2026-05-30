import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { NeonCard, NeonChip } from '../components/Neon'

type MatchTeam = {
  teamId: string
  name: string
  score: number
  isWinner: boolean
}

type MatchItem = {
  id: string
  region: string
  bestOf: number
  finishedAt: string
  winnerTeamId: string | null
  teams: MatchTeam[]
}

type MatchesResponse = {
  total: number
  page: number
  pageSize: number
  items: MatchItem[]
}

type SearchItem = {
  playerId: string
  nickname: string
  avatar?: string | null
  country?: string | null
  matches?: number
  rating?: number
}

type Filters = {
  map: string
  playerId: string
  playerName: string
  from: string
  to: string
}

const PAGE_SIZE = 30

const EMPTY_FILTERS: Filters = {
  map: '',
  playerId: '',
  playerName: '',
  from: '',
  to: '',
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: MatchesResponse }

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function dateKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'unknown'
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function formatDayHeader(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Без даты'
  return d.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

type DayGroup = { key: string; iso: string; items: MatchItem[] }

function groupByDay(items: MatchItem[]): DayGroup[] {
  const groups: DayGroup[] = []
  const index = new Map<string, DayGroup>()
  for (const m of items) {
    const key = dateKey(m.finishedAt)
    let g = index.get(key)
    if (!g) {
      g = { key, iso: m.finishedAt, items: [] }
      index.set(key, g)
      groups.push(g)
    }
    g.items.push(m)
  }
  return groups
}

export function MatchesPage() {
  const [page, setPage] = useState(1)
  // Применённые фильтры (по ним идёт запрос).
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('pageSize', String(PAGE_SIZE))
    if (filters.map) params.set('map', filters.map)
    if (filters.playerId) params.set('player', filters.playerId)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)

    fetch(`/api/matches?${params.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return (await r.json()) as MatchesResponse
      })
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [page, filters])

  const total = state.status === 'ready' ? state.data.total : 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const canPrev = page > 1
  const canNext = page < totalPages

  const groups = useMemo(
    () => (state.status === 'ready' ? groupByDay(state.data.items) : []),
    [state],
  )

  const hasActiveFilters =
    !!filters.map || !!filters.playerId || !!filters.from || !!filters.to

  function applyFilters(next: Filters) {
    setPage(1)
    setFilters(next)
  }

  function resetFilters() {
    setPage(1)
    setFilters(EMPTY_FILTERS)
  }

  return (
    <div className="relative z-10 mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <NeonChip color="magenta">Матчи</NeonChip>
        {state.status === 'ready' && total > 0 && (
          <span className="font-display text-xs uppercase tracking-wider text-text-dim">
            Всего:{' '}
            <span className="tabular-nums text-neon-cyan neon-text-cyan">{total}</span>
          </span>
        )}
      </div>

      <FiltersPanel
        filters={filters}
        hasActiveFilters={hasActiveFilters}
        onApply={applyFilters}
        onReset={resetFilters}
      />

      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorState />}

      {state.status === 'ready' && state.data.items.length === 0 && (
        <EmptyState filtered={hasActiveFilters} />
      )}

      {state.status === 'ready' && state.data.items.length > 0 && (
        <>
          <div className="space-y-8">
            {groups.map((g) => (
              <section key={g.key} className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="font-display text-sm font-bold uppercase tracking-[0.2em] text-neon-cyan neon-text-cyan">
                    {formatDayHeader(g.iso)}
                  </span>
                  <span className="h-px flex-1 bg-gradient-to-r from-neon-cyan/40 to-transparent" />
                  <span className="font-display text-xs uppercase tracking-wider text-text-dim tabular-nums">
                    {g.items.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {g.items.map((m) => (
                    <MatchRow key={m.id} match={m} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="flex items-center justify-center gap-4 pt-2">
            <PagerButton disabled={!canPrev} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              ◄ Назад
            </PagerButton>
            <span className="font-display text-sm uppercase tracking-wider text-text-dim">
              Стр.{' '}
              <span className="tabular-nums text-neon-magenta neon-text-magenta">{page}</span>{' '}
              / <span className="tabular-nums text-neon-cyan neon-text-cyan">{totalPages}</span>
            </span>
            <PagerButton
              disabled={!canNext}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Вперёд ►
            </PagerButton>
          </div>
        </>
      )}
    </div>
  )
}

function FiltersPanel({
  filters,
  hasActiveFilters,
  onApply,
  onReset,
}: {
  filters: Filters
  hasActiveFilters: boolean
  onApply: (next: Filters) => void
  onReset: () => void
}) {
  // Черновик: правки локально, применяются по выбору/Enter/blur даты.
  const [draft, setDraft] = useState<Filters>(filters)

  // Синхронизируем черновик с применёнными фильтрами (например, после сброса).
  useEffect(() => {
    setDraft(filters)
  }, [filters])

  const [maps, setMaps] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    fetch('/api/maps')
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return (await r.json()) as unknown
      })
      .then((data) => {
        if (cancelled) return
        // Бэкенд может вернуть массив строк или { items: [...] }.
        let list: string[] = []
        if (Array.isArray(data)) {
          list = data.filter((x): x is string => typeof x === 'string')
        } else if (data && typeof data === 'object' && 'items' in data) {
          const items = (data as { items?: unknown }).items
          if (Array.isArray(items)) {
            list = items.filter((x): x is string => typeof x === 'string')
          }
        }
        setMaps(list)
      })
      .catch(() => {
        if (!cancelled) setMaps([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  function setMap(map: string) {
    const next = { ...draft, map }
    setDraft(next)
    onApply(next)
  }

  function setFrom(from: string) {
    const next = { ...draft, from }
    setDraft(next)
    onApply(next)
  }

  function setTo(to: string) {
    const next = { ...draft, to }
    setDraft(next)
    onApply(next)
  }

  function selectPlayer(p: SearchItem) {
    const next = { ...draft, playerId: p.playerId, playerName: p.nickname }
    setDraft(next)
    onApply(next)
  }

  function clearPlayer() {
    const next = { ...draft, playerId: '', playerName: '' }
    setDraft(next)
    onApply(next)
  }

  return (
    <NeonCard color="cyan" className="px-4 py-4 sm:px-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Карта">
          <select
            value={draft.map}
            onChange={(e) => setMap(e.target.value)}
            className="w-full rounded-lg border border-neon-purple/60 bg-bg-elev/80 px-3 py-2 font-display text-sm uppercase tracking-wider text-text outline-none transition focus:border-neon-cyan focus:shadow-neon-cyan"
          >
            <option value="">Все карты</option>
            {maps.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Игрок">
          <PlayerSearch
            playerId={draft.playerId}
            playerName={draft.playerName}
            onSelect={selectPlayer}
            onClear={clearPlayer}
          />
        </Field>

        <Field label="С даты">
          <input
            type="date"
            value={draft.from}
            max={draft.to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-lg border border-neon-purple/60 bg-bg-elev/80 px-3 py-2 font-display text-sm uppercase tracking-wider text-text outline-none transition focus:border-neon-cyan focus:shadow-neon-cyan [color-scheme:dark]"
          />
        </Field>

        <Field label="По дату">
          <input
            type="date"
            value={draft.to}
            min={draft.from || undefined}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-lg border border-neon-purple/60 bg-bg-elev/80 px-3 py-2 font-display text-sm uppercase tracking-wider text-text outline-none transition focus:border-neon-cyan focus:shadow-neon-cyan [color-scheme:dark]"
          />
        </Field>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="font-display text-xs uppercase tracking-wider text-text-dim">
          {hasActiveFilters ? 'Фильтры активны' : 'Фильтры не заданы'}
        </span>
        <button
          type="button"
          onClick={onReset}
          disabled={!hasActiveFilters}
          className="rounded-lg border border-neon-magenta/60 bg-bg-soft/80 px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-neon-magenta transition enabled:hover:border-neon-magenta enabled:hover:shadow-neon-magenta disabled:cursor-not-allowed disabled:opacity-30"
        >
          Сбросить
        </button>
      </div>
    </NeonCard>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-display text-[0.65rem] font-bold uppercase tracking-[0.18em] text-text-dim">
        {label}
      </span>
      {children}
    </label>
  )
}

function PlayerSearch({
  playerId,
  playerName,
  onSelect,
  onClear,
}: {
  playerId: string
  playerName: string
  onSelect: (p: SearchItem) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchItem[]>([])
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement | null>(null)

  // Закрывать подсказки по клику вне.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  // Дебаунс-поиск.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 1) {
      setResults([])
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}&limit=10`)
        .then(async (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return (await r.json()) as { items?: SearchItem[] }
        })
        .then((data) => {
          if (!cancelled) setResults(Array.isArray(data?.items) ? data.items : [])
        })
        .catch(() => {
          if (!cancelled) setResults([])
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  // Если игрок выбран — показываем чип с возможностью убрать.
  if (playerId) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-neon-cyan/60 bg-bg-elev/80 px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-neon-cyan neon-text-cyan">
          {playerName || playerId}
        </span>
        <button
          type="button"
          onClick={() => {
            setQuery('')
            setResults([])
            setOpen(false)
            onClear()
          }}
          aria-label="Убрать игрока"
          className="shrink-0 rounded-md border border-neon-magenta/50 px-2 font-display text-xs text-neon-magenta transition hover:border-neon-magenta hover:shadow-neon-magenta"
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        type="text"
        value={query}
        placeholder="Ник игрока…"
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        className="w-full rounded-lg border border-neon-purple/60 bg-bg-elev/80 px-3 py-2 text-sm text-text placeholder:text-text-dim/60 outline-none transition focus:border-neon-cyan focus:shadow-neon-cyan"
      />
      {open && query.trim().length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-lg border border-neon-cyan/60 bg-bg-elev/95 shadow-neon-cyan backdrop-blur-sm">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-text-dim">Ничего не найдено</div>
          ) : (
            results.map((p) => (
              <button
                key={p.playerId}
                type="button"
                onClick={() => {
                  onSelect(p)
                  setQuery('')
                  setResults([])
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-neon-purple/10"
              >
                {p.avatar ? (
                  <img
                    src={p.avatar}
                    alt=""
                    className="h-6 w-6 shrink-0 rounded-full border border-neon-purple/50 object-cover"
                  />
                ) : (
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-neon-purple/50 text-xs text-text-dim">
                    ?
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">
                  {p.nickname}
                </span>
                {typeof p.rating === 'number' && (
                  <span className="shrink-0 font-display text-xs tabular-nums text-neon-cyan neon-text-cyan">
                    {Math.round(p.rating)}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function MatchRow({ match }: { match: MatchItem }) {
  const [teamA, teamB] = match.teams

  return (
    <Link to={`/matches/${match.id}`} className="block">
      <NeonCard
        color="purple"
        className="px-5 py-4 transition hover:bg-neon-purple/10 hover:shadow-neon-magenta"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center justify-center gap-4 sm:justify-start">
            <TeamSide team={teamA} align="right" />
            <span className="font-display text-sm font-bold uppercase tracking-widest text-text-dim">
              vs
            </span>
            <TeamSide team={teamB} align="left" />
          </div>

          <div className="flex shrink-0 items-center justify-center gap-3 text-xs text-text-dim sm:flex-col sm:items-end sm:gap-1">
            <span className="rounded-md border border-neon-cyan/50 px-2 py-0.5 font-display uppercase tracking-wider text-neon-cyan neon-text-cyan">
              {match.region || '—'}
            </span>
            <span className="font-display uppercase tracking-wider text-neon-magenta">
              bo{match.bestOf}
            </span>
            <span className="tabular-nums">{formatTime(match.finishedAt)}</span>
          </div>
        </div>
      </NeonCard>
    </Link>
  )
}

function TeamSide({ team, align }: { team: MatchTeam | undefined; align: 'left' | 'right' }) {
  if (!team) {
    return <div className="min-w-0 flex-1 text-text-dim">—</div>
  }
  const winnerName = team.isWinner
    ? 'text-neon-magenta neon-text-magenta'
    : 'text-text'
  const winnerScore = team.isWinner
    ? 'text-neon-magenta neon-text-magenta'
    : 'text-text-dim'
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-3 ${
        align === 'right' ? 'flex-row-reverse text-right' : 'text-left'
      }`}
    >
      <span
        className={`shrink-0 font-display text-2xl font-black tabular-nums ${winnerScore}`}
      >
        {team.score}
      </span>
      <span className={`truncate font-semibold ${winnerName}`}>{team.name}</span>
    </div>
  )
}

function PagerButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-xl border border-neon-purple/70 bg-bg-soft/80 px-5 py-2 font-display text-sm font-bold uppercase tracking-wider text-neon-purple transition enabled:hover:border-neon-magenta enabled:hover:text-neon-magenta enabled:hover:shadow-neon-magenta disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
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

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <NeonCard color="purple" className="px-6 py-16 text-center">
      <p className="font-display text-xl uppercase tracking-[0.2em] text-text-dim">
        {filtered ? 'Ничего не найдено' : 'Матчей пока нет'}
      </p>
      <p className="mt-2 text-sm text-text-dim/70">
        {filtered
          ? 'Под выбранные фильтры матчей нет. Измените условия или сбросьте фильтры.'
          : 'Как только хаб опубликует игры — они появятся здесь.'}
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
        Не удалось загрузить список матчей. Попробуйте обновить страницу позже.
      </p>
    </NeonCard>
  )
}

export default MatchesPage
