import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { IrrigationRecommendation, IrrigationSchedule, IrrigationTask, IrrigationStatus } from '@domain/entities/Irrigation'
import { analyticsApi } from '@infrastructure/api/AnalyticsApi'
import { irrigationApi } from '@infrastructure/api/IrrigationApi'

interface IrrigationState {
  recommendations: Record<string, IrrigationRecommendation[]>
  schedules: Record<string, IrrigationSchedule>
  tasks: Record<string, IrrigationTask[]>   // keyed by fieldId
  loading: boolean
  tasksLoading: boolean
  error: string | null
}

const initialState: IrrigationState = {
  recommendations: {},
  schedules: {},
  tasks: {},
  loading: false,
  tasksLoading: false,
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
  async (
    { fieldId, cropType, currentMoisture }: { fieldId: string; cropType?: string; currentMoisture?: number },
    { rejectWithValue }
  ) => {
    try {
      const data = await analyticsApi.getIrrigationSchedule(fieldId, cropType, currentMoisture)
      return { fieldId, data }
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Ошибка загрузки расписания полива')
    }
  }
)

export const fetchIrrigationTasks = createAsyncThunk(
  'irrigation/fetchTasks',
  async (fieldId: string, { rejectWithValue }) => {
    try {
      const data = await irrigationApi.getTasksByField(fieldId)
      return { fieldId, data }
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Ошибка загрузки задач полива')
    }
  }
)

export const updateTaskStatus = createAsyncThunk(
  'irrigation/updateTaskStatus',
  async ({ taskId, fieldId, status }: { taskId: string; fieldId: string; status: IrrigationStatus }, { rejectWithValue }) => {
    try {
      const updated = await irrigationApi.updateTaskStatus(taskId, status)
      return { fieldId, updated }
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Ошибка обновления статуса задачи')
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
      // recommendations
      .addCase(fetchIrrigationRecommendations.pending, (state) => { state.loading = true; state.error = null })
      .addCase(fetchIrrigationRecommendations.fulfilled, (state, action) => {
        state.loading = false
        state.recommendations[action.payload.fieldId] = action.payload.data
      })
      .addCase(fetchIrrigationRecommendations.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      // schedule
      .addCase(fetchIrrigationSchedule.pending, (state) => { state.loading = true; state.error = null })
      .addCase(fetchIrrigationSchedule.fulfilled, (state, action) => {
        state.loading = false
        state.schedules[action.payload.fieldId] = action.payload.data
      })
      .addCase(fetchIrrigationSchedule.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      // tasks (Java irrigation-service)
      .addCase(fetchIrrigationTasks.pending, (state) => { state.tasksLoading = true; state.error = null })
      .addCase(fetchIrrigationTasks.fulfilled, (state, action) => {
        state.tasksLoading = false
        state.tasks[action.payload.fieldId] = action.payload.data
      })
      .addCase(fetchIrrigationTasks.rejected, (state, action) => {
        state.tasksLoading = false
        state.error = action.payload as string
      })
      // update status
      .addCase(updateTaskStatus.fulfilled, (state, action) => {
        const { fieldId, updated } = action.payload
        const fieldTasks = state.tasks[fieldId]
        if (fieldTasks) {
          const idx = fieldTasks.findIndex(t => t.id === updated.id)
          if (idx !== -1) fieldTasks[idx] = updated
        }
      })
      .addCase(updateTaskStatus.rejected, (state, action) => {
        state.error = action.payload as string
      })
  },
})

export const { clearError } = irrigationSlice.actions
export default irrigationSlice.reducer
