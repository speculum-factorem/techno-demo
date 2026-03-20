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
