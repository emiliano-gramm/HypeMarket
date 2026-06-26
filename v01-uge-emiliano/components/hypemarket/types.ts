export type OutcomeKey = 'alpha' | 'beta'

export type MarketStatus = 'live' | 'locked' | 'resolved'

export interface Outcome {
  key: OutcomeKey
  team: string
  tag: string
  /** decimal odds, e.g. 1.85 */
  odds: number
  /** implied share 0..1 used for the market bar */
  share: number
  /** total credits backing this outcome (parimutuel pool) */
  pool: number
  /** number of backers on this outcome */
  backers: number
}

export interface Position {
  id: string
  outcomeKey: OutcomeKey
  team: string
  staked: number
  odds: number
}

export interface ActivityItem {
  id: string
  user: string
  amount: number
  team: string
  outcomeKey: OutcomeKey
  /** seconds ago */
  ago: number
}

export interface ArenaEvent {
  id: string
  t: string
  kind: 'kill' | 'objective' | 'round' | 'info'
  text: string
}

/** Transient pulse ring on the minimap — only kills/objectives pulse. */
export interface ArenaPulse {
  id: string
  x: number
  y: number
  kind: 'kill' | 'objective'
}

/** Compact stat overlay shown in a minimap corner. */
export interface ArenaStats {
  alphaKills: number
  betaKills: number
  alphaObjectives: number
  betaObjectives: number
}

/** Resolution state: user's outcome and payout */
export interface MarketResolution {
  winnerKey: OutcomeKey
  userWon: boolean
  userPayout: number
  newBalance: number
}
