import apiClient from './ApiClient'

export type SatelliteSeriesPoint = {
  date: string
  ndvi: number
  ndmi: number
  cloudCover?: number | null
}

export type SatelliteGridStats = {
  meanNdvi?: number | null
  meanNdmi?: number | null
  minNdvi?: number | null
  maxNdvi?: number | null
  coverageGoodPercent: number
  stressLowVegetationPercent: number
}

export type SatelliteGridResponse = {
  fieldId: string
  fieldName: string
  date: string
  index: 'ndvi' | 'ndmi'
  source: string
  itemId?: string | null
  sceneDatetime?: string | null
  cloudCover?: number | null
  cells: (number | null)[][]
  stats: SatelliteGridStats
}

export const satelliteApi = {
  async getDates(fieldId: string, days = 120): Promise<{ dates: string[]; fieldName: string }> {
    const { data } = await apiClient.get<{ dates: string[]; fieldName: string }>(
      `/analytics/satellite/field/${fieldId}/dates`,
      { params: { days } },
    )
    return data
  },

  async getSeries(fieldId: string, days = 120, maxPoints = 8): Promise<{ points: SatelliteSeriesPoint[] }> {
    const { data } = await apiClient.get<{ points: SatelliteSeriesPoint[] }>(
      `/analytics/satellite/field/${fieldId}/series`,
      { params: { days, max_points: maxPoints } },
    )
    return data
  },

  async getGrid(
    fieldId: string,
    date: string,
    index: 'ndvi' | 'ndmi',
    gridW = 12,
    gridH = 8,
  ): Promise<SatelliteGridResponse> {
    const { data } = await apiClient.get<SatelliteGridResponse>(`/analytics/satellite/field/${fieldId}/grid`, {
      params: { date, index, grid_w: gridW, grid_h: gridH },
    })
    return data
  },
}
