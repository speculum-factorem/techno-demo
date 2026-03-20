export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export interface YieldForecast {
  id: string
  fieldId: string
  fieldName: string
  cropType: string
  forecastDate: string
  predictedYield: number // t/ha
  yieldMin: number
  yieldMax: number
  confidence: ConfidenceLevel
  factors: ForecastFactor[]
  historicalAverage?: number
  modelVersion: string
  createdAt: string
}

export interface ForecastFactor {
  name: string
  impact: 'positive' | 'negative' | 'neutral'
  weight: number // 0-1
  description: string
}

export interface HistoricalYield {
  year: number
  yield: number
  cropType: string
  precipitation: number
  avgTemperature: number
}

export interface ForecastRequest {
  fieldId: string
  targetDate: string
  includeFactors?: boolean
}
