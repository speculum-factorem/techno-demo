import apiClient from './ApiClient'
import { Field, CreateFieldDto, FieldPassport, FieldSatellite, FieldFinance } from '@domain/entities/Field'

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
    const { data } = await apiClient.get<FieldApiDto[]>('/fields')
    return data.map(toDomainField)
  },

  async getById(id: string): Promise<Field> {
    const { data } = await apiClient.get<FieldApiDto>(`/fields/${id}`)
    return toDomainField(data)
  },

  async create(dto: CreateFieldDto): Promise<Field> {
    const { data } = await apiClient.post<FieldApiDto>('/fields', toCreateApiDto(dto))
    return toDomainField(data)
  },

  async update(id: string, dto: Partial<CreateFieldDto>): Promise<Field> {
    const updateDto = {
      ...dto,
      ...(dto.coordinates ? { lat: dto.coordinates.lat, lng: dto.coordinates.lng } : {}),
    }
    delete (updateDto as any).coordinates
    const { data } = await apiClient.put<FieldApiDto>(`/fields/${id}`, updateDto)
    return toDomainField(data)
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/fields/${id}`)
  },

  async getPassport(fieldId: string): Promise<FieldPassport> {
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
