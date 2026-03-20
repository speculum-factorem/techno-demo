import apiClient from './ApiClient'
import { USE_MOCK } from './config'
import { YieldForecast, ForecastRequest, HistoricalYield } from '@domain/entities/Forecast'
import { IrrigationRecommendation, IrrigationSchedule } from '@domain/entities/Irrigation'
import { mockYieldForecasts, mockHistoricalYields, mockIrrigationRecommendations } from './MockData'

type HistoricalYieldApiDto = {
  year: number
  yield_amount: number
  cropType: string
  precipitation: number
  avgTemperature: number
}

export const analyticsApi = {
  async getYieldForecast(request: ForecastRequest): Promise<YieldForecast> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 1200))
      const forecasts = mockYieldForecasts[request.fieldId]
      return forecasts?.[0] || mockYieldForecasts['1'][0]
    }
    const { data } = await apiClient.post<YieldForecast>('/analytics/forecast/yield', request)
    return data
  },

  async getYieldForecastsByField(fieldId: string): Promise<YieldForecast[]> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 600))
      return mockYieldForecasts[fieldId] || []
    }
    const { data } = await apiClient.get<YieldForecast[]>(`/analytics/forecast/yield/field/${fieldId}`)
    return data
  },

  async getHistoricalYield(fieldId: string): Promise<HistoricalYield[]> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 400))
      return mockHistoricalYields
    }
    const { data } = await apiClient.get<HistoricalYieldApiDto[]>(`/analytics/yield/historical/${fieldId}`)
    return data.map((item) => ({
      year: item.year,
      yield: item.yield_amount,
      cropType: item.cropType,
      precipitation: item.precipitation,
      avgTemperature: item.avgTemperature,
    }))
  },

  async getIrrigationRecommendations(fieldId: string): Promise<IrrigationRecommendation[]> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 500))
      return mockIrrigationRecommendations[fieldId] || []
    }
    const { data } = await apiClient.get<IrrigationRecommendation[]>(`/analytics/irrigation/recommendations/${fieldId}`)
    return data
  },

  async getIrrigationSchedule(fieldId: string): Promise<IrrigationSchedule> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 500))
      const recs = mockIrrigationRecommendations[fieldId] || []
      return {
        fieldId,
        fieldName: recs[0]?.fieldName || '',
        entries: recs.map(r => ({
          date: r.recommendedDate,
          waterAmount: r.waterAmount,
          duration: r.duration,
          status: r.status,
          priority: r.priority,
        })),
        totalWaterNeeded: recs.reduce((sum, r) => sum + r.waterAmount, 0),
        nextIrrigationDate: recs[0]?.recommendedDate || '',
      }
    }
    const { data } = await apiClient.get<IrrigationSchedule>(`/analytics/irrigation/schedule/${fieldId}`)
    return data
  },
}
