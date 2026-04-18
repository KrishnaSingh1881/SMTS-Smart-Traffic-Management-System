export type SimulationState = 'STOPPED' | 'RUNNING' | 'PAUSED'

export type ScenarioType =
  | 'rush_hour'
  | 'stadium_exodus'
  | 'major_accident'
  | 'flash_flood'

export type TriggerType = 'scheduled' | 'scenario' | 'gridlock_alert' | 'manual'

export interface ActiveScenario {
  id: string
  type: ScenarioType
  startSimTime: number        // simulated minutes since midnight
  durationSimMinutes: number
  affectedSegmentIds: string[]
  incidentIds: string[]       // persisted incident IDs
}

export interface EmergencyVehicle {
  id: string
  route: string[]             // array of intersection IDs
  currentIndex: number        // index into route
  speedKmh: number
  state: 'DISPATCHED' | 'IN_TRANSIT' | 'COMPLETED'
  preemptedSignalIds: string[]
}

export interface SimulationStatus {
  state: SimulationState
  simulatedTime: string       // "HH:MM"
  speed: number
  activeScenarios: string[]
  emergencyVehicleCount: number
}

export interface AIInsight {
  id: string
  trigger: TriggerType
  text: string
  simulatedTime: string
  createdAt: number           // Date.now()
}
