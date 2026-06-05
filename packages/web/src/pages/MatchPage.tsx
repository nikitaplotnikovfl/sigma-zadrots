import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { NeonCard, NeonChip } from '../components/Neon'

type Team = {
  teamId: string
  name: string
  score: number
  isWinner: boolean
}

type MapInfo = {
  mapNum: number
  mapName: string | null
  teams: Team[]
}

type Match = {
  id: string
  region: string
  bestOf: number
  finishedAt: string | null
  winnerTeamId: string | null
  teams: Team[]
  maps: MapInfo[]
}

type PlayerStat = {
  playerId: string
  nickname: string
  teamId: string
  teamName: string
  mapNum: number
  mapName: string | null
  won: boolean
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

type MatchResponse = {
  match: Match
  stats: PlayerStat[]
}

type LoadState = 'loading' | 'ok' | 'notfound' | 'error'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Spinner() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-14 w-14 animate-spin rounded-full border-4 border-neon-purple/25 border-t-neon-magenta shadow-neon-magenta" />
        <div className="font-display text-sm uppercase tracking-[0.3em] text-neon-cyan neon-text-cyan">
          Загрузка…
        </div>
      </div>
    </div>
  )
}

function CenterMessage({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <div className="grid min-h-[40vh] place-items-center px-4">
      <NeonCard color="magenta" className="max-w-md p-8 text-center">
        <div className="font-display text-3xl font-black uppercase tracking-[0.2em] text-neon-magenta neon-text-magenta">
          {title}
        </div>
        <p className="mt-4 text-text-dim">{subtitle}</p>
      </NeonCard>
    </div>
  )
}

type StatColumn = {
  key: keyof Pick<
    PlayerStat,
    'rating' | 'kills' | 'deaths' | 'assists' | 'kd' | 'adr' | 'hsPct' | 'mvps'
  >
  label: string
  fmt?: (v: number) => string
}

const STAT_COLUMNS: StatColumn[] = [
  { key: 'rating', label: 'Рейтинг', fmt: (v) => v.toFixed(2) },
  { key: 'kills', label: 'K' },
  { key: 'deaths', label: 'D' },
  { key: 'assists', label: 'A' },
  { key: 'kd', label: 'K/D', fmt: (v) => v.toFixed(2) },
  { key: 'adr', label: 'ADR', fmt: (v) => v.toFixed(1) },
  { key: 'hsPct', label: 'HS%', fmt: (v) => `${v.toFixed(1)}%` },
  { key: 'mvps', label: 'MVP' },
]

function TeamStatsTable({
  teamName,
  rows,
  isWinner,
}: {
  teamName: string
  rows: PlayerStat[]
  isWinner: boolean
}) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.rating - a.rating),
    [rows],
  )

  return (
    <NeonCard
      color={isWinner ? 'cyan' : 'purple'}
      className={`overflow-hidden ${isWinner ? 'animate-pulse-glow' : ''}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-neon-purple/20 px-5 py-4">
        <h3
          className={`font-display text-lg font-bold uppercase tracking-[0.16em] ${
            isWinner ? 'text-neon-cyan neon-text-cyan' : 'text-text'
          }`}
        >
          {teamName}
        </h3>
        {isWinner && (
          <span className="rounded-md border border-neon-cyan/70 px-2 py-0.5 font-display text-xs font-bold uppercase tracking-wider text-neon-cyan neon-text-cyan">
            Победитель
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-text-dim">
              <th className="px-3 py-3 text-left font-display text-xs uppercase tracking-wider">
                Игрок
              </th>
              {STAT_COLUMNS.map((c) => (
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
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={STAT_COLUMNS.length + 1}
                  className="px-3 py-6 text-center text-text-dim"
                >
                  Нет статистики
                </td>
              </tr>
            )}
            {sorted.map((p) => (
              <tr
                key={`${p.playerId}-${p.mapNum}`}
                className="group border-t border-neon-purple/15 transition hover:bg-neon-purple/10"
              >
                <td className="px-3 py-3">
                  <Link
                    to={`/players/${p.playerId}`}
                    className="flex items-center gap-3 font-semibold text-text transition group-hover:text-neon-magenta"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-full border border-neon-magenta/50 bg-bg-elev font-display text-xs text-neon-magenta">
                      {p.nickname.slice(0, 2).toUpperCase()}
                    </span>
                    {p.nickname}
                  </Link>
                </td>
                {STAT_COLUMNS.map((c) => {
                  const v = p[c.key]
                  const isRating = c.key === 'rating'
                  return (
                    <td
                      key={c.key}
                      className={`whitespace-nowrap px-3 py-3 text-right tabular-nums ${
                        isRating
                          ? 'font-display font-bold text-neon-cyan neon-text-cyan'
                          : 'text-text'
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
  )
}

function isWinnerTeam(team: Team | undefined, winnerTeamId: string | null): boolean {
  if (!team) return false
  return team.isWinner || winnerTeamId === team.teamId
}

function scoreClass(team: Team | undefined, winnerTeamId: string | null): string {
  return isWinnerTeam(team, winnerTeamId) ? 'text-neon-magenta neon-text-magenta' : ''
}

function TeamName({
  team,
  winnerTeamId,
  align,
}: {
  team: Team | undefined
  winnerTeamId: string | null
  align: 'left' | 'right'
}) {
  const winner = isWinnerTeam(team, winnerTeamId)
  return (
    <div
      className={`min-w-0 ${align === 'left' ? 'text-left' : 'text-right'} ${
        winner ? '' : 'opacity-80'
      }`}
    >
      <div
        className={`truncate font-display text-2xl font-black uppercase tracking-[0.12em] sm:text-3xl ${
          winner ? 'text-neon-cyan neon-text-cyan' : 'text-text'
        }`}
      >
        {team?.name ?? '—'}
      </div>
      {winner && (
        <div className="mt-1 font-display text-xs uppercase tracking-[0.25em] text-neon-cyan neon-text-cyan">
          Победитель
        </div>
      )}
    </div>
  )
}

export function MatchPage() {
  const { id } = useParams<{ id: string }>()
  const [state, setState] = useState<LoadState>('loading')
  const [data, setData] = useState<MatchResponse | null>(null)

  useEffect(() => {
    if (!id) {
      setState('notfound')
      return
    }
    let cancelled = false
    setState('loading')
    setData(null)
    fetch(`/api/matches/${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (res.status === 404) {
          if (!cancelled) setState('notfound')
          return
        }
        if (!res.ok) {
          if (!cancelled) setState('error')
          return
        }
        const json = (await res.json()) as MatchResponse
        if (!cancelled) {
          setData(json)
          setState('ok')
        }
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [id])

  // карта mapNum -> инфо о карте из match.maps (счёт раундов, победитель карты)
  const mapInfoByNum = useMemo(() => {
    const map = new Map<number, MapInfo>()
    data?.match.maps?.forEach((m) => map.set(m.mapNum, m))
    return map
  }, [data])

  // основной источник секций — stats, сгруппированные по mapNum.
  // внутри карты — группировка по teamId (игрок ровно один раз на карту).
  const mapSections = useMemo(() => {
    type TeamGroup = { teamId: string; teamName: string; rows: PlayerStat[] }
    type Section = {
      mapNum: number
      mapName: string | null
      teamOrder: string[]
      teams: Map<string, TeamGroup>
    }
    const sections = new Map<number, Section>()
    data?.stats.forEach((s) => {
      let section = sections.get(s.mapNum)
      if (!section) {
        section = {
          mapNum: s.mapNum,
          mapName: s.mapName,
          teamOrder: [],
          teams: new Map(),
        }
        sections.set(s.mapNum, section)
      }
      if (!section.mapName && s.mapName) section.mapName = s.mapName
      let group = section.teams.get(s.teamId)
      if (!group) {
        group = { teamId: s.teamId, teamName: s.teamName, rows: [] }
        section.teams.set(s.teamId, group)
        section.teamOrder.push(s.teamId)
      }
      group.rows.push(s)
    })
    return [...sections.values()].sort((a, b) => a.mapNum - b.mapNum)
  }, [data])

  if (state === 'loading') return <Spinner />

  if (state === 'notfound')
    return (
      <CenterMessage
        title="Матч не найден"
        subtitle="Возможно, ссылка устарела или хаб ещё не опубликовал этот матч."
      />
    )

  if (state === 'error' || !data)
    return (
      <CenterMessage
        title="Ошибка"
        subtitle="Не удалось загрузить матч. Попробуй обновить страницу чуть позже."
      />
    )

  const { match } = data

  // серия: BO2+ показываем счёт по картам из match.teams; иначе одиночная карта
  const isSeries = match.bestOf >= 2 && mapSections.length > 1
  // имя карты для шапки одиночного матча
  const singleMapName =
    mapSections[0]?.mapName ?? match.maps?.[0]?.mapName ?? null

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      {/* Шапка матча */}
      <NeonCard color="magenta" className="overflow-hidden p-6">
        <div className="flex flex-wrap items-center gap-3">
          <NeonChip color="cyan">Матч</NeonChip>
          <span className="rounded-md border border-neon-purple/60 px-3 py-1 font-display text-xs font-bold uppercase tracking-wider text-text-dim">
            BO{match.bestOf}
          </span>
          <span className="rounded-md border border-neon-purple/60 px-3 py-1 font-display text-xs font-bold uppercase tracking-wider text-text-dim">
            {match.region}
          </span>
          {!isSeries && singleMapName && (
            <span className="rounded-md border border-neon-cyan/60 px-3 py-1 font-display text-xs font-bold uppercase tracking-wider text-neon-cyan neon-text-cyan">
              {singleMapName}
            </span>
          )}
          <span className="ml-auto text-sm text-text-dim">
            {formatDate(match.finishedAt)}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <TeamName team={match.teams[0]} winnerTeamId={match.winnerTeamId} align="left" />
          <div className="font-display text-4xl font-black tabular-nums text-text sm:text-5xl">
            <span className={scoreClass(match.teams[0], match.winnerTeamId)}>
              {match.teams[0]?.score ?? 0}
            </span>
            <span className="mx-2 text-text-dim">:</span>
            <span className={scoreClass(match.teams[1], match.winnerTeamId)}>
              {match.teams[1]?.score ?? 0}
            </span>
          </div>
          <TeamName team={match.teams[1]} winnerTeamId={match.winnerTeamId} align="right" />
        </div>

        {/* Подзаголовок: карты со счётами (для серии BO2+) */}
        {isSeries && match.maps && match.maps.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 border-t border-neon-purple/20 pt-4">
            {[...match.maps]
              .sort((a, b) => a.mapNum - b.mapNum)
              .map((m) => (
                <span
                  key={`hdr-map-${m.mapNum}`}
                  className="rounded-md border border-neon-purple/50 px-3 py-1 font-display text-xs font-bold uppercase tracking-wider text-text-dim"
                >
                  {m.mapName ?? `Карта ${m.mapNum}`}{' '}
                  <span className="tabular-nums text-text">
                    {m.teams[0]?.score ?? 0} : {m.teams[1]?.score ?? 0}
                  </span>
                </span>
              ))}
          </div>
        )}
      </NeonCard>

      {/* Секции по картам */}
      {mapSections.length === 0 ? (
        <CenterMessage
          title="Нет статистики"
          subtitle="Для этого матча пока нет статистики игроков."
        />
      ) : (
        mapSections.map((section) => {
          const info = mapInfoByNum.get(section.mapNum)
          const title =
            section.mapName ?? info?.mapName ?? `Карта ${section.mapNum}`
          return (
            <section key={`map-${section.mapNum}`} className="space-y-4">
              {/* Заголовок карты */}
              <div className="flex flex-wrap items-center gap-3">
                <NeonChip color="purple">{title}</NeonChip>
                {info && info.teams.length > 0 && (
                  <span className="font-display text-2xl font-black tabular-nums text-text">
                    <span className={scoreClass(info.teams[0], null)}>
                      {info.teams[0]?.score ?? 0}
                    </span>
                    <span className="mx-2 text-text-dim">:</span>
                    <span className={scoreClass(info.teams[1], null)}>
                      {info.teams[1]?.score ?? 0}
                    </span>
                  </span>
                )}
              </div>

              {/* Две таблицы команд на этой карте */}
              <div className="grid gap-6 lg:grid-cols-2">
                {section.teamOrder.map((teamId) => {
                  const group = section.teams.get(teamId)
                  if (!group) return null
                  const mapTeam = info?.teams.find(
                    (t) => t.teamId === teamId,
                  )
                  const isWinner = mapTeam
                    ? mapTeam.isWinner
                    : Boolean(group.rows[0]?.won)
                  return (
                    <TeamStatsTable
                      key={`map-${section.mapNum}-team-${teamId}`}
                      teamName={group.teamName || mapTeam?.name || 'Команда'}
                      rows={group.rows}
                      isWinner={isWinner}
                    />
                  )
                })}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}

export default MatchPage
