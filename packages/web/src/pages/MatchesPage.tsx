import { useEffect, useState } from 'react'
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

const PAGE_SIZE = 30

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: MatchesResponse }

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MatchesPage() {
  const [page, setPage] = useState(1)
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    fetch(`/api/matches?page=${page}&pageSize=${PAGE_SIZE}`)
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
  }, [page])

  const total = state.status === 'ready' ? state.data.total : 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const canPrev = page > 1
  const canNext = page < totalPages

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

      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorState />}

      {state.status === 'ready' && state.data.items.length === 0 && <EmptyState />}

      {state.status === 'ready' && state.data.items.length > 0 && (
        <>
          <div className="space-y-3">
            {state.data.items.map((m) => (
              <MatchRow key={m.id} match={m} />
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
            <span className="tabular-nums">{formatDate(match.finishedAt)}</span>
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

function EmptyState() {
  return (
    <NeonCard color="purple" className="px-6 py-16 text-center">
      <p className="font-display text-xl uppercase tracking-[0.2em] text-text-dim">
        Матчей пока нет
      </p>
      <p className="mt-2 text-sm text-text-dim/70">
        Как только хаб опубликует игры — они появятся здесь.
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
