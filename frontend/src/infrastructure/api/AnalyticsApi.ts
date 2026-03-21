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

  async getDatasetEda(nSamples = 2000): Promise<any> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 600))
      return {
        dataset_info: {
          n_rows: nSamples, n_cols: 13,
          mandatory_fields: ['field_id','date','timestamp','temperature','humidity_air','precipitation','wind_speed','soil_moisture','crop_type','yield_actual','irrigation_volume','irrigation_recommended','is_anomaly'],
          date_range: { from: '2024-04-01', to: '2025-03-31' },
          unique_fields: 20, unique_crops: 7,
        },
        descriptive_stats: {
          temperature: { count: nSamples, mean: 22.4, std: 7.1, min: 5.0, q25: 16.8, median: 22.5, q75: 28.2, max: 44.0, missing: 0 },
          humidity_air: { count: nSamples, mean: 60.3, std: 18.4, min: 25.1, q25: 46.2, median: 61.0, q75: 75.8, max: 97.9, missing: 0 },
          precipitation: { count: nSamples, mean: 5.8, std: 5.3, min: 0.0, q25: 1.1, median: 4.5, q75: 9.4, max: 24.9, missing: 0 },
          wind_speed: { count: nSamples, mean: 4.6, std: 3.1, min: 0.3, q25: 2.2, median: 4.0, q75: 6.7, max: 13.9, missing: 0 },
          soil_moisture: { count: nSamples, mean: 42.8, std: 19.7, min: 2.0, q25: 27.4, median: 42.0, q75: 58.5, max: 97.3, missing: 0 },
          yield_actual: { count: nSamples, mean: 0.62, std: 0.18, min: 0.05, q25: 0.49, median: 0.63, q75: 0.76, max: 0.99, missing: 0 },
          irrigation_volume: { count: nSamples, mean: 3.8, std: 2.9, min: 0.0, q25: 1.2, median: 3.4, q75: 6.1, max: 14.8, missing: 0 },
          irrigation_recommended: { count: nSamples, mean: 3.3, std: 2.5, min: 0.0, q25: 1.0, median: 3.0, q75: 5.3, max: 15.0, missing: 0 },
        },
        anomaly_analysis: {
          total_anomalies: Math.round(nSamples * 0.031),
          anomaly_rate_pct: 3.1,
          anomaly_by_crop: { wheat: 9, corn: 8, sunflower: 6, barley: 7, soy: 5, sugar_beet: 9, other: 8 },
        },
        crop_distribution: { wheat: Math.round(nSamples*0.21), corn: Math.round(nSamples*0.18), sunflower: Math.round(nSamples*0.14), barley: Math.round(nSamples*0.16), soy: Math.round(nSamples*0.12), sugar_beet: Math.round(nSamples*0.10), other: Math.round(nSamples*0.09) },
        yield_by_crop: { wheat: 0.59, corn: 0.65, sunflower: 0.57, barley: 0.55, soy: 0.60, sugar_beet: 0.72, other: 0.52 },
        outliers: {
          temperature: { iqr_outliers: Math.round(nSamples*0.018), outlier_rate_pct: 1.8 },
          humidity_air: { iqr_outliers: Math.round(nSamples*0.009), outlier_rate_pct: 0.9 },
          soil_moisture: { iqr_outliers: Math.round(nSamples*0.024), outlier_rate_pct: 2.4 },
          precipitation: { iqr_outliers: Math.round(nSamples*0.031), outlier_rate_pct: 3.1 },
          yield_actual: { iqr_outliers: Math.round(nSamples*0.011), outlier_rate_pct: 1.1 },
          wind_speed: { iqr_outliers: Math.round(nSamples*0.016), outlier_rate_pct: 1.6 },
          irrigation_volume: { iqr_outliers: Math.round(nSamples*0.022), outlier_rate_pct: 2.2 },
          irrigation_recommended: { iqr_outliers: Math.round(nSamples*0.019), outlier_rate_pct: 1.9 },
        },
        correlation_matrix: {
          soil_moisture: { temperature: -0.32, humidity_air: 0.61, precipitation: 0.48, soil_moisture: 1.0, yield_actual: 0.58, irrigation_volume: -0.44 },
          temperature: { temperature: 1.0, humidity_air: -0.28, precipitation: -0.15, soil_moisture: -0.32, yield_actual: -0.21, irrigation_volume: 0.31 },
          yield_actual: { temperature: -0.21, humidity_air: 0.35, precipitation: 0.40, soil_moisture: 0.58, yield_actual: 1.0, irrigation_volume: 0.27 },
        },
      }
    }
    const { data } = await apiClient.get(`/analytics/dataset/eda?n_samples=${nSamples}`)
    return data
  },

  async generateDataset(nSamples = 1000): Promise<any> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 400))
      return { n_rows: nSamples, fields: ['field_id','date','timestamp','temperature','humidity_air','precipitation','wind_speed','soil_moisture','crop_type','yield_actual','irrigation_volume','irrigation_recommended','is_anomaly'], data: [] }
    }
    const { data } = await apiClient.get(`/analytics/dataset/generate?n_samples=${nSamples}`)
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
