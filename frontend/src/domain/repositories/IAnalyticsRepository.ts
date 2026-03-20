import { YieldForecast, ForecastRequest, HistoricalYield } from '../entities/Forecast'
import { IrrigationRecommendation, IrrigationSchedule } from '../entities/Irrigation'

export interface IAnalyticsRepository {
  getYieldForecast(request: ForecastRequest): Promise<YieldForecast>
  getYieldForecastsByField(fieldId: string): Promise<YieldForecast[]>
  getHistoricalYield(fieldId: string): Promise<HistoricalYield[]>
  getIrrigationRecommendations(fieldId: string): Promise<IrrigationRecommendation[]>
  getIrrigationSchedule(fieldId: string): Promise<IrrigationSchedule>
}
