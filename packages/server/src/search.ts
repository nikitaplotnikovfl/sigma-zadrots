import { prisma } from './db.js'

export interface SearchItem {
  playerId: string
  nickname: string
  avatar: string | null
  country: string | null
  matches: number
  rating: number
}

/**
 * Поиск игроков: nickname содержит q (без регистра), сортировка по rating desc.
 * Игроки без агрегата считаются matches=0, rating=0.
 */
export async function searchPlayers(q: string, limit = 10): Promise<SearchItem[]> {
  const needle = q.trim()
  if (!needle) return []

  const players = await prisma.player.findMany({
    where: { nickname: { contains: needle, mode: 'insensitive' } },
    include: { aggregate: true },
  })

  const items: SearchItem[] = players.map((p) => ({
    playerId: p.id,
    nickname: p.nickname,
    avatar: p.avatar,
    country: p.country,
    matches: p.aggregate?.matches ?? 0,
    rating: p.aggregate?.rating ?? 0,
  }))

  items.sort((a, b) => b.rating - a.rating || a.nickname.localeCompare(b.nickname))
  return items.slice(0, Math.max(1, limit))
}
