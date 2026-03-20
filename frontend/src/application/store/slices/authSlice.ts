import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { User, LoginDto, RegisterDto, AuthTokens } from '@domain/entities/User'
import { authApi } from '@infrastructure/api/AuthApi'

interface AuthState {
  user: User | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null
  registerSuccess: string | null
}

const initialState: AuthState = {
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  tokens: JSON.parse(localStorage.getItem('tokens') || 'null'),
  isAuthenticated: !!localStorage.getItem('tokens'),
  loading: false,
  error: null,
  registerSuccess: null,
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

export const register = createAsyncThunk(
  'auth/register',
  async (dto: RegisterDto, { rejectWithValue }) => {
    try {
      const result = await authApi.register(dto)
      return result
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message || err.response?.data?.error || 'Ошибка регистрации'
      )
    }
  }
)

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null
      state.registerSuccess = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true
        state.error = null
        state.registerSuccess = null
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
      .addCase(register.pending, (state) => {
        state.loading = true
        state.error = null
        state.registerSuccess = null
      })
      .addCase(register.fulfilled, (state, action: PayloadAction<{ message: string }>) => {
        state.loading = false
        state.registerSuccess = action.payload.message
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null
        state.tokens = null
        state.isAuthenticated = false
        state.registerSuccess = null
        localStorage.removeItem('user')
        localStorage.removeItem('tokens')
      })
  },
})

export const { clearError } = authSlice.actions
export default authSlice.reducer
