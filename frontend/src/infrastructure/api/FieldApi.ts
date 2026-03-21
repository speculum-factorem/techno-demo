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
      const field = mockFields.find(f => f.id === fieldId)
      return {
        fieldId,
        fieldName: field?.name || 'Поле',
        operations: [
          { type: 'irrigation', date: '2026-03-01', description: 'Полив капельный', amount: 45, unit: 'л/м²', cost: 12600 },
          { type: 'irrigation', date: '2026-02-15', description: 'Плановый полив', amount: 38, unit: 'л/м²', cost: 10640 },
          { type: 'seeding', date: '2025-10-10', description: 'Посев озимой пшеницы', amount: 220, unit: 'кг/га', cost: 38500 },
          { type: 'harvest', date: '2025-07-20', description: 'Уборка урожая (предыдущий сезон)', cost: 28000 },
        ],
        fertilizers: [
          { type: 'fertilizer', date: '2026-02-28', description: 'NPK 16:16:16', amount: 180, unit: 'кг/га', cost: 27000 },
          { type: 'fertilizer', date: '2025-11-05', description: 'Аммиачная селитра', amount: 120, unit: 'кг/га', cost: 15600 },
        ],
        treatments: [
          { type: 'treatment', date: '2026-03-10', description: 'Обработка фунгицидом (Альто Супер)', amount: 0.5, unit: 'л/га', cost: 8750 },
          { type: 'treatment', date: '2025-12-20', description: 'Гербицид (Балерина)', amount: 0.35, unit: 'л/га', cost: 5250 },
        ],
        results: [
          { season: '2024/2025', cropType: field?.cropType || 'wheat', yieldActual: 4.7, yieldPlan: 4.5, revenueActual: 556140, costActual: 142800 },
          { season: '2023/2024', cropType: field?.cropType || 'wheat', yieldActual: 4.2, yieldPlan: 4.3, revenueActual: 496440, costActual: 138500 },
        ],
        totals: { totalCost: 146300, totalFertilizerKg: 300, totalWaterM3: 4150, operationsCount: 8 },
      }
    }
    const { data } = await apiClient.get<FieldPassport>(`/fields/${fieldId}/passport`)
    return data
  },

  async getSatellite(fieldId: string, days = 14): Promise<FieldSatellite> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 400))
      const today = new Date()
      const timeline = Array.from({ length: days }, (_, i) => {
        const d = new Date(today)
        d.setDate(d.getDate() - (days - 1 - i))
        const t = i / days
        return {
          date: d.toISOString().split('T')[0],
          ndvi: parseFloat((0.55 + t * 0.18 + (Math.random() - 0.5) * 0.06).toFixed(3)),
          ndmi: parseFloat((0.28 + t * 0.10 + (Math.random() - 0.5) * 0.04).toFixed(3)),
        }
      })
      return {
        fieldId,
        latestNdvi: timeline[timeline.length - 1].ndvi,
        latestNdmi: timeline[timeline.length - 1].ndmi,
        stressLevel: 'Низкий',
        timeline,
        alerts: ['Незначительное снижение NDVI в северо-западном углу поля (2026-03-08)'],
        recommendations: ['Продолжить плановый полив согласно расписанию', 'Повторная спутниковая съёмка через 7 дней'],
      }
    }
    const { data } = await apiClient.get<FieldSatellite>(`/fields/${fieldId}/satellite?days=${days}`)
    return data
  },

  async getFinance(fieldId: string): Promise<FieldFinance> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 300))
      const area = mockFields.find(f => f.id === fieldId)?.area ?? 50
      const costPerHa = 2860
      const planCost = area * costPerHa
      const actualCost = planCost * 0.97
      const grossRevenue = area * 4.7 * 13500
      const margin = grossRevenue - actualCost
      return {
        fieldId,
        planCost: Math.round(planCost),
        actualCost: Math.round(actualCost),
        grossRevenue: Math.round(grossRevenue),
        margin: Math.round(margin),
        marginPercent: parseFloat(((margin / grossRevenue) * 100).toFixed(1)),
        costPerHectare: costPerHa,
        waterSavingPercent: 18,
        breakdown: [
          { category: 'Семена', planned: Math.round(area * 385), actual: Math.round(area * 370) },
          { category: 'Удобрения', planned: Math.round(area * 840), actual: Math.round(area * 825) },
          { category: 'СЗР', planned: Math.round(area * 280), actual: Math.round(area * 295) },
          { category: 'Полив', planned: Math.round(area * 420), actual: Math.round(area * 340) },
          { category: 'Техника и топливо', planned: Math.round(area * 550), actual: Math.round(area * 528) },
          { category: 'Прочие расходы', planned: Math.round(area * 385), actual: Math.round(area * 398) },
        ],
      }
    }
    const { data } = await apiClient.get<FieldFinance>(`/fields/${fieldId}/finance`)
    return data
  },
}
