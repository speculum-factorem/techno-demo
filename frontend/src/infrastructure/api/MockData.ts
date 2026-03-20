import { Field } from '@domain/entities/Field'
import { WeatherData, WeatherSummary, WeatherForecast } from '@domain/entities/WeatherData'
import { YieldForecast, HistoricalYield } from '@domain/entities/Forecast'
import { IrrigationRecommendation, IrrigationSchedule } from '@domain/entities/Irrigation'
import { Alert } from '@domain/entities/Alert'
import { User } from '@domain/entities/User'

export const mockFields: Field[] = [
  {
    id: '1',
    name: 'Поле №1 «Северное»',
    area: 45.5,
    cropType: 'wheat',
    status: 'active',
    coordinates: { lat: 47.2357, lng: 39.7015 },
    soilType: 'Чернозём',
    plantingDate: '2024-04-15',
    expectedHarvestDate: '2024-08-20',
    currentMoistureLevel: 62,
    createdAt: '2024-01-10T09:00:00Z',
    updatedAt: '2024-06-01T10:00:00Z',
  },
  {
    id: '2',
    name: 'Поле №2 «Южное»',
    area: 78.2,
    cropType: 'sunflower',
    status: 'active',
    coordinates: { lat: 47.1850, lng: 39.7215 },
    soilType: 'Суглинок',
    plantingDate: '2024-05-01',
    expectedHarvestDate: '2024-09-15',
    currentMoistureLevel: 45,
    createdAt: '2024-01-10T09:00:00Z',
    updatedAt: '2024-06-01T10:00:00Z',
  },
  {
    id: '3',
    name: 'Поле №3 «Восточное»',
    area: 32.1,
    cropType: 'corn',
    status: 'active',
    coordinates: { lat: 47.2500, lng: 39.7500 },
    soilType: 'Чернозём',
    plantingDate: '2024-05-10',
    expectedHarvestDate: '2024-09-30',
    currentMoistureLevel: 71,
    createdAt: '2024-01-10T09:00:00Z',
    updatedAt: '2024-06-01T10:00:00Z',
  },
  {
    id: '4',
    name: 'Поле №4 «Западное»',
    area: 58.7,
    cropType: 'barley',
    status: 'idle',
    coordinates: { lat: 47.2100, lng: 39.6800 },
    soilType: 'Песчаник',
    currentMoistureLevel: 38,
    createdAt: '2024-01-10T09:00:00Z',
    updatedAt: '2024-06-01T10:00:00Z',
  },
]

const generateWeatherHistory = (fieldId: string): WeatherData[] => {
  const data: WeatherData[] = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    data.push({
      id: `${fieldId}-${i}`,
      fieldId,
      timestamp: date.toISOString(),
      temperature: 18 + Math.random() * 12,
      humidity: 45 + Math.random() * 35,
      precipitation: Math.random() > 0.7 ? Math.random() * 20 : 0,
      windSpeed: 2 + Math.random() * 8,
      windDirection: Math.random() * 360,
      pressure: 1005 + Math.random() * 20,
      solarRadiation: 200 + Math.random() * 400,
      soilMoisture: 40 + Math.random() * 40,
      soilTemperature: 15 + Math.random() * 10,
      source: 'api',
    })
  }
  return data
}

const generateForecast = (): WeatherForecast[] => {
  const forecasts: WeatherForecast[] = []
  const weatherDescriptions = [
    'Ясно', 'Переменная облачность', 'Облачно', 'Небольшой дождь', 'Умеренный дождь'
  ]
  for (let i = 0; i < 7; i++) {
    const date = new Date()
    date.setDate(date.getDate() + i)
    const hasPrecip = Math.random() > 0.5
    forecasts.push({
      date: date.toISOString().split('T')[0],
      tempMin: 14 + Math.random() * 6,
      tempMax: 22 + Math.random() * 10,
      precipitationProbability: hasPrecip ? 30 + Math.random() * 60 : Math.random() * 20,
      precipitation: hasPrecip ? Math.random() * 15 : 0,
      humidity: 40 + Math.random() * 40,
      windSpeed: 2 + Math.random() * 10,
      weatherCode: hasPrecip ? 61 : 1,
      description: weatherDescriptions[Math.floor(Math.random() * weatherDescriptions.length)],
    })
  }
  return forecasts
}

export const mockWeatherSummaries: Record<string, WeatherSummary> = Object.fromEntries(
  mockFields.map(f => [f.id, {
    current: {
      id: `current-${f.id}`,
      fieldId: f.id,
      timestamp: new Date().toISOString(),
      temperature: 24.5 + Math.random() * 5,
      humidity: 55 + Math.random() * 20,
      precipitation: 0,
      windSpeed: 3.2,
      windDirection: 180,
      pressure: 1013,
      solarRadiation: 620,
      soilMoisture: f.currentMoistureLevel,
      soilTemperature: 21.3,
      source: 'sensor',
    },
    forecast: generateForecast(),
    averageTemperature7d: 22.8,
    totalPrecipitation7d: 12.4,
    averageHumidity7d: 61.2,
  }])
)

export const mockHistoricalWeather: Record<string, WeatherData[]> = Object.fromEntries(
  mockFields.map(f => [f.id, generateWeatherHistory(f.id)])
)

export const mockYieldForecasts: Record<string, YieldForecast[]> = {
  '1': [{
    id: 'yf1',
    fieldId: '1',
    fieldName: 'Поле №1 «Северное»',
    cropType: 'Пшеница',
    forecastDate: new Date().toISOString().split('T')[0],
    predictedYield: 4.8,
    yieldMin: 4.1,
    yieldMax: 5.5,
    confidence: 'HIGH',
    historicalAverage: 4.3,
    factors: [
      { name: 'Достаточное количество осадков', impact: 'positive', weight: 0.35, description: 'Осадки 12.4 мм за последние 7 дней' },
      { name: 'Оптимальная температура', impact: 'positive', weight: 0.28, description: 'Средняя температура 22.8°C в пределах нормы' },
      { name: 'Высокая влажность почвы', impact: 'positive', weight: 0.22, description: 'Влажность почвы 62%' },
      { name: 'Ветровая нагрузка', impact: 'negative', weight: 0.15, description: 'Порывы ветра до 12 м/с' },
    ],
    modelVersion: '1.2.0',
    createdAt: new Date().toISOString(),
  }],
  '2': [{
    id: 'yf2',
    fieldId: '2',
    fieldName: 'Поле №2 «Южное»',
    cropType: 'Подсолнечник',
    forecastDate: new Date().toISOString().split('T')[0],
    predictedYield: 2.3,
    yieldMin: 1.8,
    yieldMax: 2.8,
    confidence: 'MEDIUM',
    historicalAverage: 2.1,
    factors: [
      { name: 'Дефицит влаги', impact: 'negative', weight: 0.45, description: 'Влажность почвы 45% - ниже оптимального уровня' },
      { name: 'Высокая солнечная активность', impact: 'positive', weight: 0.30, description: 'Солнечная радиация 620 Вт/м²' },
      { name: 'Оптимальная температура', impact: 'positive', weight: 0.25, description: 'Температура в пределах нормы для культуры' },
    ],
    modelVersion: '1.2.0',
    createdAt: new Date().toISOString(),
  }],
  '3': [{
    id: 'yf3',
    fieldId: '3',
    fieldName: 'Поле №3 «Восточное»',
    cropType: 'Кукуруза',
    forecastDate: new Date().toISOString().split('T')[0],
    predictedYield: 7.2,
    yieldMin: 6.5,
    yieldMax: 8.0,
    confidence: 'HIGH',
    historicalAverage: 6.8,
    factors: [
      { name: 'Оптимальная влажность почвы', impact: 'positive', weight: 0.40, description: 'Влажность 71% - идеально для кукурузы' },
      { name: 'Благоприятные температуры', impact: 'positive', weight: 0.35, description: 'Ночные температуры выше 12°C' },
      { name: 'Минимальные осадки', impact: 'neutral', weight: 0.25, description: 'Осадки в норме, без избытка' },
    ],
    modelVersion: '1.2.0',
    createdAt: new Date().toISOString(),
  }],
}

export const mockHistoricalYields: HistoricalYield[] = [
  { year: 2019, yield: 3.9, cropType: 'Пшеница', precipitation: 380, avgTemperature: 21.5 },
  { year: 2020, yield: 4.2, cropType: 'Пшеница', precipitation: 420, avgTemperature: 22.1 },
  { year: 2021, yield: 3.5, cropType: 'Пшеница', precipitation: 310, avgTemperature: 23.8 },
  { year: 2022, yield: 4.6, cropType: 'Пшеница', precipitation: 450, avgTemperature: 21.9 },
  { year: 2023, yield: 4.3, cropType: 'Пшеница', precipitation: 395, avgTemperature: 22.4 },
  { year: 2024, yield: 4.8, cropType: 'Пшеница', precipitation: 410, avgTemperature: 22.8 },
]

export const mockIrrigationRecommendations: Record<string, IrrigationRecommendation[]> = {
  '1': [
    {
      id: 'ir1',
      fieldId: '1',
      fieldName: 'Поле №1 «Северное»',
      recommendedDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      waterAmount: 25,
      duration: 120,
      priority: 'medium',
      reason: 'Прогнозируется снижение влажности почвы ниже 55% через 2 дня',
      moistureDeficit: 8,
      confidence: 82,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    },
  ],
  '2': [
    {
      id: 'ir2',
      fieldId: '2',
      fieldName: 'Поле №2 «Южное»',
      recommendedDate: new Date().toISOString().split('T')[0],
      waterAmount: 40,
      duration: 180,
      priority: 'high',
      reason: 'Влажность почвы 45% значительно ниже оптимального уровня для подсолнечника (60-70%)',
      moistureDeficit: 22,
      confidence: 91,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'ir3',
      fieldId: '2',
      fieldName: 'Поле №2 «Южное»',
      recommendedDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      waterAmount: 30,
      duration: 140,
      priority: 'medium',
      reason: 'Профилактический полив перед прогнозируемым засушливым периодом',
      moistureDeficit: 12,
      confidence: 74,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    },
  ],
  '3': [],
  '4': [
    {
      id: 'ir4',
      fieldId: '4',
      fieldName: 'Поле №4 «Западное»',
      recommendedDate: new Date().toISOString().split('T')[0],
      waterAmount: 50,
      duration: 210,
      priority: 'critical',
      reason: 'КРИТИЧНО: Влажность 38% - возможная гибель посевов без немедленного полива',
      moistureDeficit: 32,
      confidence: 97,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    },
  ],
}

export const mockAlerts: Alert[] = [
  {
    id: 'a1',
    type: 'anomaly',
    severity: 'critical',
    title: 'Аномалия данных датчика',
    message: 'Датчик влажности почвы на Поле №4 зафиксировал значение 98% — вероятно, сбой оборудования. Прогноз помечен как «Низкая достоверность».',
    fieldId: '4',
    fieldName: 'Поле №4 «Западное»',
    isRead: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'a2',
    type: 'irrigation',
    severity: 'critical',
    title: 'Критически низкая влажность почвы',
    message: 'Влажность почвы на Поле №4 составляет 38%, что ниже критического порога. Требуется немедленный полив.',
    fieldId: '4',
    fieldName: 'Поле №4 «Западное»',
    isRead: false,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'a3',
    type: 'weather',
    severity: 'warning',
    title: 'Прогноз засухи',
    message: 'На следующие 5 дней прогнозируется отсутствие осадков при высоких температурах (до 32°C). Рекомендуется профилактический полив.',
    isRead: false,
    createdAt: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    id: 'a4',
    type: 'forecast',
    severity: 'info',
    title: 'Прогноз урожайности обновлён',
    message: 'Модель пересчитала прогноз урожайности для Поля №1. Ожидаемая урожайность: 4.8 т/га (+11% к среднему).',
    fieldId: '1',
    fieldName: 'Поле №1 «Северное»',
    isRead: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
]

export const mockUser: User = {
  id: 'u1',
  username: 'agronomist',
  email: 'agronomist@centroinvest.ru',
  fullName: 'Иванов Алексей Николаевич',
  role: 'AGRONOMIST',
}
