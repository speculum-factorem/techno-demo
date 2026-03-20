import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { Field, CreateFieldDto } from '@domain/entities/Field'
import { fieldApi } from '@infrastructure/api/FieldApi'

interface FieldsState {
  items: Field[]
  selected: Field | null
  loading: boolean
  error: string | null
}

const initialState: FieldsState = {
  items: [],
  selected: null,
  loading: false,
  error: null,
}

export const fetchFields = createAsyncThunk('fields/fetchAll', async (_, { rejectWithValue }) => {
  try {
    return await fieldApi.getAll()
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Ошибка загрузки полей')
  }
})

export const fetchFieldById = createAsyncThunk(
  'fields/fetchById',
  async (id: string, { rejectWithValue }) => {
    try {
      return await fieldApi.getById(id)
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Ошибка загрузки поля')
    }
  }
)

export const createField = createAsyncThunk(
  'fields/create',
  async (dto: CreateFieldDto, { rejectWithValue }) => {
    try {
      return await fieldApi.create(dto)
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Ошибка создания поля')
    }
  }
)

export const updateField = createAsyncThunk(
  'fields/update',
  async ({ id, dto }: { id: string; dto: Partial<CreateFieldDto> }, { rejectWithValue }) => {
    try {
      return await fieldApi.update(id, dto)
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Ошибка обновления поля')
    }
  }
)

export const deleteField = createAsyncThunk(
  'fields/delete',
  async (id: string, { rejectWithValue }) => {
    try {
      await fieldApi.delete(id)
      return id
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Ошибка удаления поля')
    }
  }
)

const fieldsSlice = createSlice({
  name: 'fields',
  initialState,
  reducers: {
    selectField(state, action: PayloadAction<Field | null>) {
      state.selected = action.payload
    },
    clearError(state) {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFields.pending, (state) => { state.loading = true; state.error = null })
      .addCase(fetchFields.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload
      })
      .addCase(fetchFields.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(fetchFieldById.fulfilled, (state, action) => {
        state.selected = action.payload
      })
      .addCase(createField.fulfilled, (state, action) => {
        state.items.push(action.payload)
      })
      .addCase(updateField.fulfilled, (state, action) => {
        const idx = state.items.findIndex(f => f.id === action.payload.id)
        if (idx !== -1) state.items[idx] = action.payload
        if (state.selected?.id === action.payload.id) state.selected = action.payload
      })
      .addCase(deleteField.fulfilled, (state, action) => {
        state.items = state.items.filter(f => f.id !== action.payload)
        if (state.selected?.id === action.payload) state.selected = null
      })
  },
})

export const { selectField, clearError } = fieldsSlice.actions
export default fieldsSlice.reducer
