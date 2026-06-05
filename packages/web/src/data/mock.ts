// Мок-данные для разработки UI до подключения реального API.
// Структура полей повторяет будущий ответ /api/leaderboard.

export type PlayerRow = {
  id: string
  rank: number
  nickname: string
  country: string
  avatar: string
  matches: number
  wins: number
  winrate: number // %
  kills: number
  deaths: number
  assists: number
  kd: number
  kr: number
  adr: number
  hsPct: number // %
  mvps: number
  rating: number
  rankDelta?: number | null // движение мест относительно прошлого турнира
  // Δ ключевых метрик за последний турнир vs предыдущий (null — не играл в предыдущем)
  statDelta?: { rating: number; kd: number; adr: number; winrate: number } | null
}

const NICKS = [
  'n0valine', 's1mple_clone', 'ZXCursed', 'AWP_God', 'tilt_proof', 'br1ckhead',
  'Dr.Disrespawn', 'kr1stall', 'flick_machine', 'lowkey', 'pixelpusher', 'noscope_kid',
  'rushB_only', 'cl4tch', 'eco_warrior', 'baitman', 'smoke_crmnl', 'galaxy_brain',
  'one_tap_jonny', 'silent_step',
]

const COUNTRIES = ['ru', 'ua', 'by', 'kz', 'ee', 'lv']

function seeded(i: number, salt: number): number {
  const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

export const PLAYERS: PlayerRow[] = NICKS.map((nickname, i) => {
  const matches = 18 + Math.floor(seeded(i, 1) * 60)
  const winrate = 38 + Math.floor(seeded(i, 2) * 38)
  const wins = Math.round((matches * winrate) / 100)
  const kills = 280 + Math.floor(seeded(i, 3) * 900)
  const deaths = 240 + Math.floor(seeded(i, 4) * 700)
  const assists = 60 + Math.floor(seeded(i, 5) * 220)
  const kd = +(kills / Math.max(1, deaths)).toFixed(2)
  const kr = +(0.6 + seeded(i, 6) * 0.4).toFixed(2)
  const adr = +(58 + seeded(i, 7) * 45).toFixed(1)
  const hsPct = +(34 + seeded(i, 8) * 35).toFixed(1)
  const mvps = 5 + Math.floor(seeded(i, 9) * 40)
  const rating = +(0.85 + kd * 0.18 + kr * 0.25 + adr / 400).toFixed(2)
  return {
    id: `p${i + 1}`,
    rank: 0,
    nickname,
    country: COUNTRIES[i % COUNTRIES.length],
    avatar: '',
    matches,
    wins,
    winrate,
    kills,
    deaths,
    assists,
    kd,
    kr,
    adr,
    hsPct,
    mvps,
    rating,
  }
})
  .sort((a, b) => b.rating - a.rating)
  .map((p, i) => ({ ...p, rank: i + 1 }))

export const HUB = {
  name: 'SIGMA ZADROTS CUP',
  game: 'CS2',
  matches: 142,
  players: PLAYERS.length,
  lastSync: '2 мин назад',
}
