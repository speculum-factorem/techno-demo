import apiClient from './ApiClient'
import { YieldForecast, ForecastRequest, HistoricalYield } from '@domain/entities/Forecast'
import { IrrigationRecommendation, IrrigationSchedule } from '@domain/entities/Irrigation'
import { AnomalyResult, ModelMetrics } from '@domain/entities/Anomaly'
import { WhatIfSimulationRequest, WhatIfSimulationResponse } from '@domain/entities/Scenario'

type HistoricalYieldApiDto = {
  year: number
  yield_amount: number
  cropType: string
  precipitation: number
  avgTemperature: number
}

export const analyticsApi = {
  async getYieldForecast(request: ForecastRequest): Promise<YieldForecast> {
    const { data } = await apiClient.post<YieldForecast>('/analytics/forecast/yield', request)
    return data
  },

  async getYieldForecastsByField(fieldId: string): Promise<YieldForecast[]> {
    const { data } = await apiClient.get<YieldForecast[]>(`/analytics/forecast/yield/field/${fieldId}`)
    return data
  },

  async getHistoricalYield(fieldId: string): Promise<HistoricalYield[]> {
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
    const { data } = await apiClient.get<IrrigationRecommendation[]>(`/analytics/irrigation/recommendations/${fieldId}`)
    // Normalize priority and status to lowercase to handle backend casing differences (e.g. "High" -> "high")
    return data.map(r => ({
      ...r,
      priority: (r.priority as string)?.toLowerCase() as IrrigationRecommendation['priority'],
      status: (r.status as string)?.toLowerCase() as IrrigationRecommendation['status'],
    }))
  },

  async getIrrigationSchedule(
    fieldId: string,
    cropType?: string,
    currentMoisture?: number,
  ): Promise<IrrigationSchedule> {
    const params = new URLSearchParams()
    if (cropType) params.set('crop_type', cropType)
    if (currentMoisture !== undefined) params.set('current_moisture', String(currentMoisture))
    const query = params.toString() ? `?${params.toString()}` : ''
    const { data } = await apiClient.get<IrrigationSchedule>(
      `/analytics/irrigation/schedule/${fieldId}${query}`
    )
    // Normalize priority and status casing in schedule entries
    return {
      ...data,
      entries: (data.entries || []).map(e => ({
        ...e,
        priority: (e.priority as string)?.toLowerCase() as IrrigationSchedule['entries'][number]['priority'],
        status: (e.status as string)?.toLowerCase() as IrrigationSchedule['entries'][number]['status'],
      })),
    }
  },

  async detectAnomalies(sensorData: Record<string, number>): Promise<AnomalyResult> {
    const { data } = await apiClient.post<AnomalyResult>('/analytics/anomaly/detect', sensorData)
    return data
  },

  async getModelMetrics(): Promise<ModelMetrics> {
    const { data } = await apiClient.get<ModelMetrics>('/analytics/model/metrics')
    return data
  },

  async getDatasetEda(nSamples = 2000): Promise<any> {
    const { data } = await apiClient.get(`/analytics/dataset/eda?n_samples=${nSamples}`)
    return data
  },

  async generateDataset(nSamples = 1000): Promise<any> {
    const { data } = await apiClient.get(`/analytics/dataset/generate?n_samples=${nSamples}`)
    return data
  },

  async simulateWhatIf(request: WhatIfSimulationRequest): Promise<WhatIfSimulationResponse> {
    const { data } = await apiClient.post<WhatIfSimulationResponse>('/analytics/scenario/what-if', request)
    return data
  },
}
