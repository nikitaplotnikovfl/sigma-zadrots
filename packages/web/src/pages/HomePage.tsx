import { useEffect, useState } from 'react'
import { Leaderboard } from '../components/Leaderboard'
import { NeonCard, NeonChip } from '../components/Neon'
import { HUB } from '../data/mock'
import { fetchOverview } from '../api'

function StatBox({ label, value, color }: { label: string; value: string | number; color: 'magenta' | 'cyan' | 'purple' }) {
  const text =
    color === 'magenta'
      ? 'text-neon-magenta neon-text-magenta'
      : color === 'cyan'
        ? 'text-neon-cyan neon-text-cyan'
        : 'text-neon-purple'
  return (
    <NeonCard color={color} className="px-5 py-4 text-center">
      <div className={`font-display text-2xl font-black ${text}`}>{value}</div>
      <div className="mt-1 text-xs uppercase tracking-widest text-text-dim">{label}</div>
    </NeonCard>
  )
}

export default function HomePage() {
  const [matches, setMatches] = useState<number | string>(HUB.matches)
  const [players, setPlayers] = useState<number | string>(HUB.players)
  const [game, setGame] = useState<string>(HUB.game)
  const [lastSync, setLastSync] = useState<string>(HUB.lastSync)

  useEffect(() => {
    fetchOverview().then((o) => {
      if (o.live) {
        setMatches(o.matches)
        setPlayers(o.players)
        setGame(o.game)
        setLastSync(o.lastSync)
      }
    })
  }, [])

  return (
    <>
      <header className="mb-8 flex flex-col items-center gap-6">
        <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-4">
          <StatBox label="Матчей" value={matches} color="magenta" />
          <StatBox label="Игроков" value={players} color="cyan" />
          <StatBox label="Игра" value={game} color="purple" />
          <StatBox label="Обновлено" value={lastSync} color="cyan" />
        </div>
      </header>

      <section className="mb-5 flex items-center gap-4">
        <NeonChip color="magenta">Leaderboard</NeonChip>
        <div className="h-px flex-1 bg-gradient-to-r from-neon-magenta/60 to-transparent" />
      </section>

      <Leaderboard />
    </>
  )
}
