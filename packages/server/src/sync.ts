import { prisma } from './db.js'
import { faceit, type MatchStatsRound } from './faceit.js'
import { env } from './env.js'
import { logger } from './logger.js'
import { recomputeAggregates } from './aggregate.js'
import { writeRankSnapshot } from './snapshots.js'
import { parseMatchRounds } from './normalize.js'

const log = logger.child({ mod: 'sync' })
let running = false

export type SyncResult = {
  matchesSeen: number
  matchesNew: number
  players: number
  status: 'ok' | 'error' | 'skipped'
  error?: string
}

export async function syncSource(): Promise<SyncResult> {
  if (running) {
    log.warn('sync already running, skipped')
    return { matchesSeen: 0, matchesNew: 0, players: 0, status: 'skipped' }
  }
  running = true
  log.info({ hubId: env.hubId }, 'sync start')
  const run = await prisma.syncRun.create({ data: { sourceId: env.hubId } })
  let seen = 0
  let added = 0

  try {
    // 1. источник
    const hub = await faceit.getHub(env.hubId)
    await prisma.source.upsert({
      where: { id: hub.hub_id },
      create: { id: hub.hub_id, type: 'hub', name: hub.name, game: hub.game_id },
      update: { name: hub.name, game: hub.game_id },
    })

    // 2. собрать все прошлые матчи
    const items: { match_id: string; status: string; finished_at?: number }[] = []
    for (let offset = 0; ; offset += env.pageLimit) {
      const page = await faceit.getHubMatches(env.hubId, offset, env.pageLimit)
      if (!page.items.length) break
      items.push(...page.items)
      if (page.items.length < env.pageLimit) break
    }
    seen = items.length
    log.info({ seen }, 'collected past matches')

    // 3. какие уже есть в БД (со статой) — пропускаем
    const existing = new Set(
      (await prisma.match.findMany({ select: { id: true } })).map((m) => m.id),
    )
    const knownPlayers = new Set(
      (await prisma.player.findMany({ select: { id: true } })).map((p) => p.id),
    )

    // 4. обработать новые завершённые матчи
    for (const it of items) {
      if (existing.has(it.match_id)) continue
      if (it.status && it.status.toUpperCase() !== 'FINISHED') continue
      try {
        const stats = await faceit.getMatchStats(it.match_id)
        await ingestMatch(it.match_id, stats.rounds ?? [], it.finished_at, knownPlayers)
        added++
      } catch (e) {
        // одиночный матч не должен ронять весь прогон
        log.error({ matchId: it.match_id, err: (e as Error).message }, 'match ingest failed')
      }
    }

    const players = await recomputeAggregates()
    const ranked = await writeRankSnapshot()
    log.info({ ranked }, 'rank snapshot written')
    await prisma.syncRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), matchesSeen: seen, matchesNew: added, status: 'ok' },
    })
    log.info({ seen, added, players }, 'sync done')
    return { matchesSeen: seen, matchesNew: added, players, status: 'ok' }
  } catch (e) {
    log.error({ err: (e as Error).message }, 'sync failed')
    await prisma.syncRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), status: 'error', error: (e as Error).message },
    })
    return { matchesSeen: seen, matchesNew: added, players: 0, status: 'error', error: (e as Error).message }
  } finally {
    running = false
  }
}

async function ingestMatch(
  matchId: string,
  rounds: MatchStatsRound[],
  finishedAt: number | undefined,
  knownPlayers: Set<string>,
) {
  if (!rounds.length) return

  // вся нормализация — в чистой функции (тестируется без БД)
  const { match, statsRows } = parseMatchRounds(matchId, rounds, finishedAt)
  const teamsJson = JSON.stringify(match.teams)
  const mapsJson = JSON.stringify(match.maps)

  await prisma.match.upsert({
    where: { id: matchId },
    create: {
      id: matchId,
      sourceId: env.hubId,
      region: match.region,
      status: match.status,
      bestOf: match.bestOf,
      finishedAt: match.finishedAt,
      winnerTeamId: match.winnerTeamId,
      teamsJson,
      mapsJson,
    },
    update: {
      winnerTeamId: match.winnerTeamId,
      teamsJson,
      mapsJson,
      finishedAt: match.finishedAt,
      bestOf: match.bestOf,
    },
  })

  for (const row of statsRows) {
    // профиль игрока тянем один раз (для avatar/country)
    if (!knownPlayers.has(row.playerId)) {
      knownPlayers.add(row.playerId)
      try {
        const info = await faceit.getPlayer(row.playerId)
        await prisma.player.upsert({
          where: { id: row.playerId },
          create: {
            id: row.playerId,
            nickname: info.nickname ?? row.nickname,
            avatar: info.avatar,
            country: info.country,
            faceitUrl: info.faceit_url?.replace('{lang}', 'ru'),
          },
          update: {
            nickname: info.nickname ?? row.nickname,
            avatar: info.avatar,
            country: info.country,
          },
        })
      } catch {
        await prisma.player.upsert({
          where: { id: row.playerId },
          create: { id: row.playerId, nickname: row.nickname },
          update: { nickname: row.nickname },
        })
      }
    }

    await prisma.playerMatchStats.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        matchId: row.matchId,
        playerId: row.playerId,
        mapNum: row.mapNum,
        mapName: row.mapName,
        teamId: row.teamId,
        teamName: row.teamName,
        won: row.won,
        kills: row.kills,
        deaths: row.deaths,
        assists: row.assists,
        kd: row.kd,
        kr: row.kr,
        adr: row.adr,
        headshots: row.headshots,
        hsPct: row.hsPct,
        mvps: row.mvps,
        doubleKills: row.doubleKills,
        tripleKills: row.tripleKills,
        quadroKills: row.quadroKills,
        pentaKills: row.pentaKills,
        rounds: row.rounds,
        entryCount: row.entryCount,
        entryWins: row.entryWins,
        firstKills: row.firstKills,
        clutchKills: row.clutchKills,
        clutch1v1Count: row.clutch1v1Count,
        clutch1v1Wins: row.clutch1v1Wins,
        clutch1v2Count: row.clutch1v2Count,
        clutch1v2Wins: row.clutch1v2Wins,
        finishedAt: row.finishedAt,
      },
      update: {
        doubleKills: row.doubleKills,
        rounds: row.rounds,
        won: row.won,
      },
    })
  }
}
