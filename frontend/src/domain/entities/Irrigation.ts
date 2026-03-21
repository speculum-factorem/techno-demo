export type IrrigationStatus = 'scheduled' | 'active' | 'completed' | 'cancelled' | 'skipped'
export type IrrigationPriority = 'critical' | 'high' | 'medium' | 'low'

export interface IrrigationRecommendation {
  id: string
  fieldId: string
  fieldName: string
  recommendedDate: string
  waterAmount: number // mm
  duration: number // minutes
  priority: IrrigationPriority
  reason: string
  moistureDeficit: number // %
  estimatedCost?: number
  confidence: number // 0-100
  status: IrrigationStatus
  createdAt: string
}

export interface IrrigationSchedule {
  fieldId: string
  fieldName: string
  entries: IrrigationEntry[]
  totalWaterNeeded: number
  nextIrrigationDate: string
}

export interface IrrigationEntry {
  date: string
  waterAmount: number
  duration: number
  status: IrrigationStatus
  priority: IrrigationPriority
}

// Task created by Java irrigation-service (triggered via Kafka from weather events)
export interface IrrigationTask {
  id: string
  fieldId: string
  fieldName: string
  scheduledDate: string   // ISO date string, e.g. "2026-03-21"
  waterAmount: number     // mm
  duration: number        // minutes
  priority: IrrigationPriority
  reason: string
  moistureDeficit: number // %
  confidence: number      // 0–100
  status: IrrigationStatus
  createdAt: string
}
