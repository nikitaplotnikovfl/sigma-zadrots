import { useEffect, useRef, useState } from 'react'
import { NeonCard, NeonChip } from '../components/Neon'

// === Типы под GET /api/search ===
type PlayerHit = {
  playerId: string
  nickname: string
  avatar?: string | null
  country?: string | null
  matches?: number
  rating?: number
}

// === Типы под GET /api/h2h ===
type H2HSide = { id: string; nickname: string; avatar?: string | null }
type H2HRowSide = {
  kills?: number
  deaths?: number
  kd?: number
  adr?: number
  won?: boolean
}
type H2HRow = {
  matchId: string
  mapName?: string | null
  finishedAt?: string | null
  sameTeam?: boolean
  a: H2HRowSide
  b: H2HRowSide
}
type H2HResponse = {
  a: H2HSide
  b: H2HSide
  commonMatches?: number
  record?: { aWins?: number; bWins?: number }
  rows?: H2HRow[]
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

function initials(nickname: string): string {
  const parts = nickname.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function countryFlag(country?: string | null): string {
  if (!country || country.length !== 2) return ''
  const cc = country.toUpperCase()
  if (!/^[A-Z]{2}$/.test(cc)) return ''
  const base = 0x1f1e6
  return String.fromCodePoint(base + (cc.charCodeAt(0) - 65), base + (cc.charCodeAt(1) - 65))
}

function fmtNum(n?: number, digits = 2): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—'
  return n.toFixed(digits)
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function Avatar({
  nickname,
  avatar,
  size,
  ring,
}: {
  nickname: string
  avatar?: string | null
  size: string
  ring: string
}) {
  if (avatar) {
    return <img src={avatar} alt={nickname} className={`${size} rounded-full border-2 ${ring} object-cover`} />
  }
  return (
    <span
      aria-hidden
      className={`flex ${size} items-center justify-center rounded-full border-2 ${ring} bg-bg-elev font-display text-text`}
    >
      {initials(nickname)}
    </span>
  )
}

// Селектор игрока с автодополнением через /api/search
function PlayerSelect({
  label,
  accent,
  selected,
  onSelect,
}: {
  label: string
  accent: 'magenta' | 'cyan'
  selected: PlayerHit | null
  onSelect: (p: PlayerHit | null) => void
}) {
  const [q, setQ] = useState('')
  const deb = useDebounced(q, 250)
  const [items, setItems] = useState<PlayerHit[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    const term = deb.trim()
    if (!term) {
      setItems([])
      return
    }
    let alive = true
    setLoading(true)
    fetch(`/api/search?q=${encodeURIComponent(term)}&limit=10`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d: { items?: PlayerHit[] }) => {
        if (alive) setItems(Array.isArray(d?.items) ? d.items : [])
      })
      .catch(() => {
        if (alive) setItems([])
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [deb])

  // Полные статические классы — Tailwind JIT их видит (без интерполяции имён).
  const isMagenta = accent === 'magenta'
  const border = isMagenta ? 'border-neon-magenta' : 'border-neon-cyan'
  const text = isMagenta ? 'text-neon-magenta' : 'text-neon-cyan'
  const cardCls = isMagenta
    ? 'flex items-center gap-3 rounded-xl border border-neon-magenta shadow-neon-magenta bg-bg-elev px-3 py-2'
    : 'flex items-center gap-3 rounded-xl border border-neon-cyan shadow-neon-cyan bg-bg-elev px-3 py-2'
  const inputCls = isMagenta
    ? 'w-full rounded-xl border border-neon-magenta/40 bg-bg-soft px-3 py-2.5 text-sm text-text outline-none transition focus:border-neon-magenta placeholder:text-text-dim'
    : 'w-full rounded-xl border border-neon-cyan/40 bg-bg-soft px-3 py-2.5 text-sm text-text outline-none transition focus:border-neon-cyan placeholder:text-text-dim'
  const dropdownCls = isMagenta
    ? 'absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-xl border border-neon-magenta/40 shadow-neon-magenta bg-bg-elev/95 backdrop-blur-sm'
    : 'absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-xl border border-neon-cyan/40 shadow-neon-cyan bg-bg-elev/95 backdrop-blur-sm'

  return (
    <div ref={boxRef} className="relative min-w-[220px] flex-1">
      <div className={`mb-2 font-display text-xs uppercase tracking-[0.2em] ${text}`}>{label}</div>

      {selected ? (
        <div className={cardCls}>
          <Avatar nickname={selected.nickname} avatar={selected.avatar} size="h-8 w-8" ring={border} />
          <span className="flex-1 truncate text-text">
            {countryFlag(selected.country)} {selected.nickname}
          </span>
          <button
            type="button"
            onClick={() => {
              onSelect(null)
              setQ('')
              setItems([])
            }}
            aria-label="Очистить выбор"
            className={`text-lg leading-none ${text}`}
          >
            ×
          </button>
        </div>
      ) : (
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
          }}
          placeholder="Поиск игрока…"
          className={inputCls}
        />
      )}

      {open && !selected && q.trim().length > 0 && (
        <div className={dropdownCls}>
          {loading && <div className="px-3 py-3 text-sm text-text-dim">Загрузка…</div>}
          {!loading && items.length === 0 && (
            <div className="px-3 py-3 text-sm text-text-dim">Ничего не найдено</div>
          )}
          {!loading &&
            items.map((it) => (
              <button
                key={it.playerId}
                type="button"
                onClick={() => {
                  onSelect(it)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-3 border-b border-white/5 px-3 py-2 text-left transition hover:bg-white/5"
              >
                <Avatar nickname={it.nickname} avatar={it.avatar} size="h-7 w-7" ring={border} />
                <span className="flex-1 truncate text-sm text-text">
                  {countryFlag(it.country)} {it.nickname}
                </span>
                {typeof it.rating === 'number' && (
                  <span className={`font-display text-xs ${text}`}>{Math.round(it.rating)}</span>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

export default function H2HPage() {
  const [a, setA] = useState<PlayerHit | null>(null)
  const [b, setB] = useState<PlayerHit | null>(null)
  const [data, setData] = useState<H2HResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!a || !b) {
      setData(null)
      setError(null)
      return
    }
    if (a.playerId === b.playerId) {
      setData(null)
      setError('Выберите двух разных игроков')
      return
    }
    let alive = true
    setLoading(true)
    setError(null)
    fetch(`/api/h2h?a=${encodeURIComponent(a.playerId)}&b=${encodeURIComponent(b.playerId)}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}))
          throw new Error(body?.error || `Ошибка ${r.status}`)
        }
        return r.json()
      })
      .then((d: H2HResponse) => {
        if (alive) setData(d)
      })
      .catch((e: Error) => {
        if (alive) {
          setData(null)
          setError(e.message || 'Не удалось загрузить данные')
        }
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [a, b])

  const aWins = data?.record?.aWins ?? 0
  const bWins = data?.record?.bWins ?? 0
  const rows = data?.rows ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-black uppercase tracking-[0.2em] text-neon-magenta neon-text-magenta">
          Head-to-Head
        </h1>
        <p className="mt-1 text-sm text-text-dim">Сравнение двух игроков в общих матчах.</p>
      </div>

      <NeonCard color="purple" className="px-6 py-6">
        <div className="flex flex-wrap items-end gap-4">
          <PlayerSelect label="Игрок A" accent="magenta" selected={a} onSelect={setA} />
          <div className="pb-2 font-display text-xl text-text-dim">VS</div>
          <PlayerSelect label="Игрок B" accent="cyan" selected={b} onSelect={setB} />
        </div>
      </NeonCard>

      {!a || !b ? (
        <div className="py-12 text-center text-text-dim">
          Выберите двух игроков, чтобы увидеть статистику личных встреч.
        </div>
      ) : loading ? (
        <div className="py-12 text-center text-text-dim">Загрузка…</div>
      ) : error ? (
        <NeonCard color="magenta" className="px-6 py-5">
          <div className="text-neon-magenta">{error}</div>
        </NeonCard>
      ) : data ? (
        <>
          {/* Шапка сравнения */}
          <NeonCard color="cyan" className="px-6 py-6">
            <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-[1fr_auto_1fr]">
              <div className="flex items-center justify-start gap-3">
                <Avatar
                  nickname={data.a.nickname}
                  avatar={data.a.avatar}
                  size="h-12 w-12"
                  ring="border-neon-magenta"
                />
                <div>
                  <div className="font-display text-lg text-neon-magenta neon-text-magenta">{data.a.nickname}</div>
                  <div className="text-xs text-text-dim">Победы: {aWins}</div>
                </div>
              </div>

              <div className="text-center">
                <div className="font-display text-3xl tracking-widest">
                  <span className={aWins > bWins ? 'text-neon-magenta neon-text-magenta' : 'text-text'}>{aWins}</span>
                  <span className="mx-2 text-text-dim">:</span>
                  <span className={bWins > aWins ? 'text-neon-cyan neon-text-cyan' : 'text-text'}>{bWins}</span>
                </div>
                <div className="mt-1 text-xs text-text-dim">
                  Общих матчей: {data.commonMatches ?? rows.length}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <div className="text-right">
                  <div className="font-display text-lg text-neon-cyan neon-text-cyan">{data.b.nickname}</div>
                  <div className="text-xs text-text-dim">Победы: {bWins}</div>
                </div>
                <Avatar
                  nickname={data.b.nickname}
                  avatar={data.b.avatar}
                  size="h-12 w-12"
                  ring="border-neon-cyan"
                />
              </div>
            </div>
          </NeonCard>

          {/* Таблица общих матчей */}
          {rows.length === 0 ? (
            <div className="py-12 text-center text-text-dim">Общих матчей не найдено.</div>
          ) : (
            <NeonCard color="purple" className="px-2 py-2 sm:px-4 sm:py-4">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead>
                    <tr className="font-display text-[11px] uppercase tracking-[0.15em] text-text-dim">
                      <th className="px-3 py-2 text-left">Карта</th>
                      <th className="px-3 py-2 text-left">Дата</th>
                      <th className="px-3 py-2 text-left text-neon-magenta">{data.a.nickname} (K-D · K/D · ADR)</th>
                      <th className="px-3 py-2 text-left text-neon-cyan">{data.b.nickname} (K-D · K/D · ADR)</th>
                      <th className="px-3 py-2 text-left">Результат</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.matchId} className="border-t border-white/5">
                        <td className="px-3 py-2">
                          <div className="text-text">{row.mapName || '—'}</div>
                          {row.sameTeam && (
                            <span className="mt-1 inline-block rounded-md border border-neon-purple px-1.5 py-0.5 text-[10px] text-neon-purple">
                              ОДНА КОМАНДА
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-text-dim">{fmtDate(row.finishedAt)}</td>
                        <td className="px-3 py-2">
                          <span className="text-text">
                            {row.a?.kills ?? '—'}-{row.a?.deaths ?? '—'}
                          </span>{' '}
                          <span className="text-text-dim">
                            {fmtNum(row.a?.kd)} · {fmtNum(row.a?.adr, 1)}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-text">
                            {row.b?.kills ?? '—'}-{row.b?.deaths ?? '—'}
                          </span>{' '}
                          <span className="text-text-dim">
                            {fmtNum(row.b?.kd)} · {fmtNum(row.b?.adr, 1)}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-display text-xs">
                          <span className={row.a?.won ? 'text-neon-cyan' : 'text-neon-magenta'}>
                            A {row.a?.won ? 'W' : 'L'}
                          </span>
                          <span className="mx-1.5 text-text-dim">/</span>
                          <span className={row.b?.won ? 'text-neon-cyan' : 'text-neon-magenta'}>
                            B {row.b?.won ? 'W' : 'L'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </NeonCard>
          )}
        </>
      ) : (
        <div className="py-12 text-center text-text-dim">
          <NeonChip color="purple">Нет данных</NeonChip>
        </div>
      )}
    </div>
  )
}
