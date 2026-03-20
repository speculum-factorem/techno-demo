import apiClient from './ApiClient'
import { USE_MOCK } from './config'
import { Field, CreateFieldDto, FieldPassport, FieldSatellite, FieldFinance } from '@domain/entities/Field'
import { mockFields } from './MockData'

type FieldApiDto = {
  id: string
  name: string
  area: number
  cropType: string
  status: string
  lat?: number
  lng?: number
  soilType: string
  plantingDate?: string
  expectedHarvestDate?: string
  currentMoistureLevel?: number
  createdAt: string
  updatedAt: string
}

const normalizeStatus = (status?: string): Field['status'] => {
  const val = (status || '').toLowerCase()
  if (val === 'active' || val === 'idle' || val === 'harvested' || val === 'preparing') return val
  return 'active'
}

const toDomainField = (dto: FieldApiDto): Field => ({
  id: dto.id,
  name: dto.name,
  area: dto.area,
  cropType: dto.cropType as Field['cropType'],
  status: normalizeStatus(dto.status),
  coordinates: {
    lat: dto.lat ?? 47.2200,
    lng: dto.lng ?? 39.7000,
  },
  soilType: dto.soilType || '',
  plantingDate: dto.plantingDate,
  expectedHarvestDate: dto.expectedHarvestDate,
  currentMoistureLevel: dto.currentMoistureLevel,
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
})

const toCreateApiDto = (dto: CreateFieldDto) => ({
  name: dto.name,
  area: dto.area,
  cropType: dto.cropType,
  status: dto.status,
  soilType: dto.soilType,
  plantingDate: dto.plantingDate,
  lat: dto.coordinates.lat,
  lng: dto.coordinates.lng,
})

export const fieldApi = {
  async getAll(): Promise<Field[]> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 600))
      return [...mockFields]
    }
    const { data } = await apiClient.get<FieldApiDto[]>('/fields')
    return data.map(toDomainField)
  },

  async getById(id: string): Promise<Field> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 300))
      const field = mockFields.find(f => f.id === id)
      if (!field) throw new Error('Поле не найдено')
      return field
    }
    const { data } = await apiClient.get<FieldApiDto>(`/fields/${id}`)
    return toDomainField(data)
  },

  async create(dto: CreateFieldDto): Promise<Field> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 500))
      const newField: Field = {
        ...dto,
        id: String(Date.now()),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      mockFields.push(newField)
      return newField
    }
    const { data } = await apiClient.post<FieldApiDto>('/fields', toCreateApiDto(dto))
    return toDomainField(data)
  },

  async update(id: string, dto: Partial<CreateFieldDto>): Promise<Field> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 400))
      const idx = mockFields.findIndex(f => f.id === id)
      if (idx === -1) throw new Error('Поле не найдено')
      mockFields[idx] = { ...mockFields[idx], ...dto, updatedAt: new Date().toISOString() }
      return mockFields[idx]
    }
    const updateDto = {
      ...dto,
      ...(dto.coordinates ? { lat: dto.coordinates.lat, lng: dto.coordinates.lng } : {}),
    }
    delete (updateDto as any).coordinates
    const { data } = await apiClient.put<FieldApiDto>(`/fields/${id}`, updateDto)
    return toDomainField(data)
  },

  async delete(id: string): Promise<void> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 300))
      const idx = mockFields.findIndex(f => f.id === id)
      if (idx !== -1) mockFields.splice(idx, 1)
      return
    }
    await apiClient.delete(`/fields/${id}`)
  },

  async getPassport(fieldId: string): Promise<FieldPassport> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 350))
      return {
        fieldId,
        fieldName: mockFields.find(f => f.id === fieldId)?.name || 'Поле',
        operations: [],
        fertilizers: [],
        treatments: [],
        results: [],
        totals: { totalCost: 0, totalFertilizerKg: 0, totalWaterM3: 0, operationsCount: 0 },
      }
    }
    const { data } = await apiClient.get<FieldPassport>(`/fields/${fieldId}/passport`)
    return data
  },

  async getSatellite(fieldId: string, days = 14): Promise<FieldSatellite> {
    const { data } = await apiClient.get<FieldSatellite>(`/fields/${fieldId}/satellite?days=${days}`)
    return data
  },

  async getFinance(fieldId: string): Promise<FieldFinance> {
    const { data } = await apiClient.get<FieldFinance>(`/fields/${fieldId}/finance`)
    return data
  },
}
