import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { AnomalyResult, ModelMetrics } from '@domain/entities/Anomaly'
import { analyticsApi } from '@infrastructure/api/AnalyticsApi'

interface AnomalyState {
  results: Record<string, AnomalyResult>   // keyed by fieldId
  metrics: ModelMetrics | null
  loadingAnomalies: Record<string, boolean>
  loadingMetrics: boolean
  error: string | null
}

const initialState: AnomalyState = {
  results: {},
  metrics: null,
  loadingAnomalies: {},
  loadingMetrics: false,
  error: null,
}

export const detectFieldAnomalies = createAsyncThunk(
  'anomaly/detectField',
  async ({ fieldId, sensorData }: { fieldId: string; sensorData: Record<string, number> }, { rejectWithValue }) => {
    try {
      const result = await analyticsApi.detectAnomalies(sensorData)
      return { fieldId, result }
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Ошибка проверки аномалий')
    }
  }
)

export const fetchModelMetrics = createAsyncThunk(
  'anomaly/fetchMetrics',
  async (_, { rejectWithValue }) => {
    try {
      return await analyticsApi.getModelMetrics()
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Ошибка загрузки метрик модели')
    }
  }
)

const anomalySlice = createSlice({
  name: 'anomaly',
  initialState,
  reducers: {
    clearError(state) { state.error = null },
    clearFieldAnomaly(state, action) { delete state.results[action.payload] },
  },
  extraReducers: (builder) => {
    builder
      .addCase(detectFieldAnomalies.pending, (state, action) => {
        state.loadingAnomalies[action.meta.arg.fieldId] = true
      })
      .addCase(detectFieldAnomalies.fulfilled, (state, action) => {
        state.loadingAnomalies[action.payload.fieldId] = false
        state.results[action.payload.fieldId] = action.payload.result
      })
      .addCase(detectFieldAnomalies.rejected, (state, action) => {
        state.loadingAnomalies[action.meta.arg.fieldId] = false
        state.error = action.payload as string
      })
      .addCase(fetchModelMetrics.pending, (state) => { state.loadingMetrics = true })
      .addCase(fetchModelMetrics.fulfilled, (state, action) => {
        state.loadingMetrics = false
        state.metrics = action.payload
      })
      .addCase(fetchModelMetrics.rejected, (state, action) => {
        state.loadingMetrics = false
        state.error = action.payload as string
      })
  },
})

export const { clearError, clearFieldAnomaly } = anomalySlice.actions
export default anomalySlice.reducer
