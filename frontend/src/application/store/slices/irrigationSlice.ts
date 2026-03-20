import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { IrrigationRecommendation, IrrigationSchedule } from '@domain/entities/Irrigation'
import { analyticsApi } from '@infrastructure/api/AnalyticsApi'

interface IrrigationState {
  recommendations: Record<string, IrrigationRecommendation[]>
  schedules: Record<string, IrrigationSchedule>
  loading: boolean
  error: string | null
}

const initialState: IrrigationState = {
  recommendations: {},
  schedules: {},
  loading: false,
  error: null,
}

export const fetchIrrigationRecommendations = createAsyncThunk(
  'irrigation/fetchRecommendations',
  async (fieldId: string, { rejectWithValue }) => {
    try {
      const data = await analyticsApi.getIrrigationRecommendations(fieldId)
      return { fieldId, data }
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Ошибка загрузки рекомендаций')
    }
  }
)

export const fetchIrrigationSchedule = createAsyncThunk(
  'irrigation/fetchSchedule',
  async (fieldId: string, { rejectWithValue }) => {
    try {
      const data = await analyticsApi.getIrrigationSchedule(fieldId)
      return { fieldId, data }
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Ошибка загрузки расписания полива')
    }
  }
)

const irrigationSlice = createSlice({
  name: 'irrigation',
  initialState,
  reducers: {
    clearError(state) { state.error = null },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchIrrigationRecommendations.pending, (state) => { state.loading = true })
      .addCase(fetchIrrigationRecommendations.fulfilled, (state, action) => {
        state.loading = false
        state.recommendations[action.payload.fieldId] = action.payload.data
      })
      .addCase(fetchIrrigationRecommendations.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(fetchIrrigationSchedule.fulfilled, (state, action) => {
        state.schedules[action.payload.fieldId] = action.payload.data
      })
  },
})

export const { clearError } = irrigationSlice.actions
export default irrigationSlice.reducer
