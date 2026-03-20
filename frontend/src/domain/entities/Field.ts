export type CropType =
  | 'wheat'
  | 'corn'
  | 'sunflower'
  | 'barley'
  | 'soy'
  | 'sugar_beet'
  | 'other'

export type FieldStatus = 'active' | 'idle' | 'harvested' | 'preparing'

export interface Coordinates {
  lat: number
  lng: number
}

export interface Field {
  id: string
  name: string
  area: number // hectares
  cropType: CropType
  status: FieldStatus
  coordinates: Coordinates
  polygon?: Coordinates[]
  soilType: string
  plantingDate?: string
  expectedHarvestDate?: string
  currentMoistureLevel?: number // %
  createdAt: string
  updatedAt: string
}

export interface CreateFieldDto {
  name: string
  area: number
  cropType: CropType
  status: FieldStatus
  coordinates: Coordinates
  soilType: string
  plantingDate?: string
  expectedHarvestDate?: string
}

export interface FieldPassportOperation {
  date: string
  type: string
  description: string
  amount?: number
  unit?: string
  cost?: number
}

export interface FieldPassportResult {
  metric: string
  value: number
  unit: string
  period: string
}

export interface FieldPassport {
  fieldId: string
  fieldName: string
  operations: FieldPassportOperation[]
  fertilizers: FieldPassportOperation[]
  treatments: FieldPassportOperation[]
  results: FieldPassportResult[]
  totals: {
    totalCost: number
    totalFertilizerKg: number
    totalWaterM3: number
    operationsCount: number
  }
}

export interface FieldSatellitePoint {
  date: string
  ndvi: number
  ndmi: number
}

export interface FieldSatellite {
  fieldId: string
  fieldName: string
  timeline: FieldSatellitePoint[]
  latestNdvi: number
  latestNdmi: number
  stressLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  mapPreviewUrl: string
  alerts: string[]
  recommendations: string[]
}

export interface FieldFinance {
  fieldId: string
  fieldName: string
  planCost: number
  actualCost: number
  costPerHectare: number
  waterSavingPercent: number
  grossRevenue: number
  margin: number
  marginPercent: number
  breakdown: Array<{
    category: string
    planned: number
    actual: number
  }>
}
