import apiClient from './ApiClient'
import { USE_MOCK } from './config'
import { YieldForecast, ForecastRequest, HistoricalYield } from '@domain/entities/Forecast'
import { IrrigationRecommendation, IrrigationSchedule } from '@domain/entities/Irrigation'
import { AnomalyResult, ModelMetrics } from '@domain/entities/Anomaly'
import { WhatIfSimulationRequest, WhatIfSimulationResponse } from '@domain/entities/Scenario'
import { mockYieldForecasts, mockHistoricalYields, mockIrrigationRecommendations, mockModelMetrics } from './MockData'

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

  async detectAnomalies(sensorData: Record<string, number>): Promise<AnomalyResult> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 200))
      const moisture = sensorData.soilMoisture ?? 60
      const temp = sensorData.temperature ?? 22
      const humidity = sensorData.humidity ?? 60
      const alerts = []
      if (moisture > 95) alerts.push({ type: 'sensor_anomaly', severity: 'high' as const, message: `Аномальное значение влажности почвы: ${moisture}% — вероятна неисправность датчика`, field: 'soilMoisture', value: moisture, confidence: 0.97 })
      else if (moisture < 5 && moisture >= 0) alerts.push({ type: 'sensor_anomaly', severity: 'medium' as const, message: `Критически низкая влажность: ${moisture}% — возможен сбой датчика`, field: 'soilMoisture', value: moisture, confidence: 0.85 })
      else if (moisture < 0) alerts.push({ type: 'sensor_anomaly', severity: 'high' as const, message: `Отрицательная влажность: ${moisture}% — ошибка датчика`, field: 'soilMoisture', value: moisture, confidence: 0.99 })
      if (temp > 45) alerts.push({ type: 'sensor_anomaly', severity: 'high' as const, message: `Аномальная температура: ${temp}°C — проверьте датчик`, field: 'temperature', value: temp, confidence: 0.95 })
      if (humidity > 100 || humidity < 0) alerts.push({ type: 'sensor_anomaly', severity: 'high' as const, message: `Невозможное значение влажности воздуха: ${humidity}%`, field: 'humidity', value: humidity, confidence: 0.99 })
      return { hasAnomalies: alerts.length > 0, alerts, lowConfidence: alerts.length > 0 }
    }
    const { data } = await apiClient.post<AnomalyResult>('/analytics/anomaly/detect', sensorData)
    return data
  },

  async getModelMetrics(): Promise<ModelMetrics> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 800))
      return mockModelMetrics
    }
    const { data } = await apiClient.get<ModelMetrics>('/analytics/model/metrics')
    return data
  },

  async simulateWhatIf(request: WhatIfSimulationRequest): Promise<WhatIfSimulationResponse> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 700))
      const baseline = {
        name: 'Базовый',
        irrigationMultiplier: 1,
        seedingMultiplier: 1,
        expectedYield: 4.6,
        expectedYieldDeltaPercent: 0,
        expectedWaterM3: 2200,
        expectedWaterDeltaPercent: 0,
        expectedRevenue: 2860000,
        expectedCost: 1200000,
        expectedProfit: 1660000,
        roiPercent: 138.3,
      }
      const scenarios = request.scenarios.map((s, i) => ({
        name: s.name || `Сценарий ${i + 1}`,
        irrigationMultiplier: s.irrigationMultiplier,
        seedingMultiplier: s.seedingMultiplier,
        expectedYield: Number((4.6 * (1 + (s.irrigationMultiplier - 1) * 0.2 + (s.seedingMultiplier - 1) * 0.14)).toFixed(2)),
        expectedYieldDeltaPercent: Number((((1 + (s.irrigationMultiplier - 1) * 0.2 + (s.seedingMultiplier - 1) * 0.14) - 1) * 100).toFixed(2)),
        expectedWaterM3: Number((2200 * s.irrigationMultiplier).toFixed(1)),
        expectedWaterDeltaPercent: Number(((s.irrigationMultiplier - 1) * 100).toFixed(2)),
        expectedRevenue: 0,
        expectedCost: 0,
        expectedProfit: 0,
        roiPercent: Number((130 + i * 6).toFixed(2)),
      }))
      return {
        fieldId: request.fieldId,
        fieldName: 'Поле',
        baseline,
        scenarios,
        recommendedScenario: scenarios[0]?.name || 'Базовый',
        generatedAt: new Date().toISOString(),
      }
    }
    const { data } = await apiClient.post<WhatIfSimulationResponse>('/analytics/scenario/what-if', request)
    return data
  },
}
