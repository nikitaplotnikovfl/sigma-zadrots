import type { ReactNode } from 'react'

type NeonColor = 'magenta' | 'purple' | 'cyan'

const borderByColor: Record<NeonColor, string> = {
  magenta: 'border-neon-magenta/80 shadow-neon-magenta',
  purple: 'border-neon-purple/80 shadow-neon-purple',
  cyan: 'border-neon-cyan/80 shadow-neon-cyan',
}

const textByColor: Record<NeonColor, string> = {
  magenta: 'text-neon-magenta neon-text-magenta',
  purple: 'text-neon-purple',
  cyan: 'text-neon-cyan neon-text-cyan',
}

export function NeonCard({
  children,
  color = 'purple',
  className = '',
}: {
  children: ReactNode
  color?: NeonColor
  className?: string
}) {
  return (
    <div
      className={`relative rounded-2xl border bg-bg-soft/80 backdrop-blur-sm ${borderByColor[color]} ${className}`}
    >
      {children}
    </div>
  )
}

export function NeonChip({
  children,
  color = 'magenta',
  className = '',
}: {
  children: ReactNode
  color?: NeonColor
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center rounded-xl border bg-bg-soft/70 px-5 py-2 font-display text-lg font-bold uppercase tracking-[0.2em] ${borderByColor[color]} ${textByColor[color]} ${className}`}
    >
      {children}
    </span>
  )
}

export function NeonLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`select-none text-center leading-none ${className}`}>
      <div className="font-display text-4xl font-black uppercase tracking-[0.18em] text-neon-magenta neon-text-magenta animate-flicker sm:text-5xl">
        SIGMA
      </div>
      <div className="font-display text-2xl font-bold uppercase tracking-[0.42em] text-neon-cyan neon-text-cyan sm:text-3xl">
        ZADROTS
      </div>
    </div>
  )
}
