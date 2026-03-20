import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { User, LoginDto, AuthTokens } from '@domain/entities/User'
import { authApi } from '@infrastructure/api/AuthApi'

interface AuthState {
  user: User | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null
}

const initialState: AuthState = {
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  tokens: JSON.parse(localStorage.getItem('tokens') || 'null'),
  isAuthenticated: !!localStorage.getItem('tokens'),
  loading: false,
  error: null,
}

export const login = createAsyncThunk(
  'auth/login',
  async (dto: LoginDto, { rejectWithValue }) => {
    try {
      const result = await authApi.login(dto)
      return result
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Ошибка авторизации')
    }
  }
)

export const logout = createAsyncThunk('auth/logout', async () => {
  await authApi.logout()
})

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(login.fulfilled, (state, action: PayloadAction<{ user: User; tokens: AuthTokens }>) => {
        state.loading = false
        state.user = action.payload.user
        state.tokens = action.payload.tokens
        state.isAuthenticated = true
        localStorage.setItem('user', JSON.stringify(action.payload.user))
        localStorage.setItem('tokens', JSON.stringify(action.payload.tokens))
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null
        state.tokens = null
        state.isAuthenticated = false
        localStorage.removeItem('user')
        localStorage.removeItem('tokens')
      })
  },
})

export const { clearError } = authSlice.actions
export default authSlice.reducer
