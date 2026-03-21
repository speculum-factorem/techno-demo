export interface AnomalyAlert {
  type: string
  severity: 'high' | 'medium' | 'low'
  message: string
  field: string
  value: number
  confidence: number
  method?: 'physical_limit' | 'z_score'
  z_score?: number
}

export interface AnomalyResult {
  hasAnomalies: boolean
  alerts: AnomalyAlert[]
  anomalyCount: number
  lowConfidence: boolean
}

export interface CropMetrics {
  mae: number
  rmse: number
  r2: number
  samples: number
}

export interface ModelMetrics {
  overall: {
    mae: number
    rmse: number
    r2: number
    accuracy: number
    testSamples: number
  }
  byCrop: Record<string, CropMetrics>
  scenarios: Array<{
    name: string
    description: string
    inputMoisture: number
    inputTemp: number
    expectedConfidence: string
    actualConfidence: string
    status: 'pass' | 'fail'
  }>
  modelVersion: string
  trainedAt: string
}
