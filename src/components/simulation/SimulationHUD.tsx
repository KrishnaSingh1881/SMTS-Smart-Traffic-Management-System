'use client'

import { useTrafficStore } from '@/store/useTrafficStore'
import { cn } from '@/lib/utils/cn'
import { Trophy, Zap, Cloud, AlertTriangle, CheckCircle2 } from 'lucide-react'

export default function SimulationHUD() {
  const { simulation, incidents } = useTrafficStore()
  const activeIncidents = Object.values(incidents).filter(i => i.status === 'Active')

  return (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[200] flex gap-4 w-full max-w-4xl px-4 pointer-events-none">
      {/* Optimization Score */}
      <div className={cn(
        "flex-1 bg-[var(--clay-surface)]/90 backdrop-blur-md rounded-clay p-4 shadow-clay border border-[var(--clay-border)]",
        "flex items-center gap-4 pointer-events-auto"
      )}>
        <div className="w-12 h-12 rounded-full bg-[var(--clay-accent)]/20 flex items-center justify-center text-[var(--clay-accent)]">
          <Trophy size={24} />
        </div>
        <div>
          <p className="text-xs font-bold text-[var(--clay-muted)] uppercase tracking-wider">Optimization</p>
          <p className="text-2xl font-black text-[var(--clay-text)]">{simulation.optimizationScore}%</p>
        </div>
        <div className="ml-auto w-32 h-2 bg-[var(--clay-bg)] rounded-full overflow-hidden">
          <div 
            className="h-full bg-[var(--clay-accent)] transition-all duration-500 shadow-[0_0_10px_rgba(var(--clay-accent-rgb),0.5)]"
            style={{ width: `${simulation.optimizationScore}%` }}
          />
        </div>
      </div>

      {/* Experience / Progress */}
      <div className="bg-[var(--clay-surface)]/90 backdrop-blur-md rounded-clay p-4 shadow-clay border border-[var(--clay-border)] flex items-center gap-4 pointer-events-auto">
        <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-500">
          <Zap size={24} fill="currentColor" />
        </div>
        <div>
          <p className="text-xs font-bold text-[var(--clay-muted)] uppercase tracking-wider">Exp Points</p>
          <div className="flex items-baseline gap-1">
            <p className="text-2xl font-black text-[var(--clay-text)]">{simulation.experiencePoints}</p>
            <p className="text-xs font-bold text-[var(--clay-muted)]">XP</p>
          </div>
        </div>
      </div>

      {/* Weather & Active Events Feed */}
      <div className="flex flex-col gap-2 pointer-events-auto">
        <div className="bg-[var(--clay-surface)]/90 backdrop-blur-md rounded-clay px-4 py-2 shadow-clay border border-[var(--clay-border)] flex items-center gap-2">
          <Cloud size={16} className="text-blue-500" />
          <span className="text-sm font-bold text-[var(--clay-text)]">{simulation.activeWeather}</span>
        </div>
        
        {activeIncidents.length > 0 ? (
          <div className="bg-red-500/10 backdrop-blur-md rounded-clay px-4 py-2 shadow-clay border border-red-500/20 flex items-center gap-2 animate-pulse">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="text-sm font-bold text-red-600">{activeIncidents.length} Critical Issues</span>
          </div>
        ) : (
          <div className="bg-green-500/10 backdrop-blur-md rounded-clay px-4 py-2 shadow-clay border border-green-500/20 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-500" />
            <span className="text-sm font-bold text-green-600">City Flow Optimal</span>
          </div>
        )}
      </div>
    </div>
  )
}
