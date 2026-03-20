export interface WhatIfScenarioInput {
  name: string
  irrigationMultiplier: number
  seedingMultiplier: number
}

export interface WhatIfScenarioResult {
  name: string
  irrigationMultiplier: number
  seedingMultiplier: number
  expectedYield: number
  expectedYieldDeltaPercent: number
  expectedWaterM3: number
  expectedWaterDeltaPercent: number
  expectedRevenue: number
  expectedCost: number
  expectedProfit: number
  roiPercent: number
}

export interface WhatIfSimulationResponse {
  fieldId: string
  fieldName: string
  baseline: WhatIfScenarioResult
  scenarios: WhatIfScenarioResult[]
  recommendedScenario: string
  generatedAt: string
}

export interface WhatIfSimulationRequest {
  fieldId: string
  targetDate: string
  cropType?: string
  soilType?: string
  area?: number
  expectedPricePerTon?: number
  scenarios: WhatIfScenarioInput[]
}
