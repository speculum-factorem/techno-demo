import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { User, LoginDto, RegisterDto, AuthTokens } from '@domain/entities/User'
import { authApi } from '@infrastructure/api/AuthApi'

interface AuthState {
  user: User | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  initialized: boolean
  loading: boolean
  error: string | null
  registerSuccess: string | null
  loginRequestId: string | null
  loginChallengeMessage: string | null
  loginChallengeExpiresInSeconds: number | null
}

const initialState: AuthState = {
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  tokens: JSON.parse(localStorage.getItem('tokens') || 'null'),
  isAuthenticated: !!localStorage.getItem('tokens'),
  initialized: false,
  loading: false,
  error: null,
  registerSuccess: null,
  loginRequestId: null,
  loginChallengeMessage: null,
  loginChallengeExpiresInSeconds: null,
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

export const verifyLoginCode = createAsyncThunk(
  'auth/verifyLoginCode',
  async ({ requestId, code }: { requestId: string; code: string }, { rejectWithValue }) => {
    try {
      const result = await authApi.verifyLoginCode(requestId, code)
      return result
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message || err.response?.data?.error || 'Ошибка подтверждения кода'
      )
    }
  }
)

export const logout = createAsyncThunk('auth/logout', async () => {
  try {
    await authApi.logout()
  } catch {
    // Even if backend logout fails, local session must be terminated.
  }
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

export const initializeAuth = createAsyncThunk(
  'auth/initializeAuth',
  async () => {
    const rawTokens = localStorage.getItem('tokens')
    const rawUser = localStorage.getItem('user')
    if (!rawTokens) {
      return { isAuthenticated: false }
    }

    const tokens = JSON.parse(rawTokens) as AuthTokens

    try {
      const user = await authApi.me()
      return { isAuthenticated: true, user, tokens }
    } catch {
      // Backend unavailable or mock mode — fall back to cached user
      if (rawUser) {
        const user = JSON.parse(rawUser) as User
        return { isAuthenticated: true, user, tokens }
      }
      localStorage.removeItem('tokens')
      localStorage.removeItem('user')
      return { isAuthenticated: false }
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
    clearLoginChallenge(state) {
      state.loginRequestId = null
      state.loginChallengeMessage = null
      state.loginChallengeExpiresInSeconds = null
    },
    setLoginChallenge(state, action: PayloadAction<{ requestId: string; message: string; expiresInSeconds: number }>) {
      state.loginRequestId = action.payload.requestId
      state.loginChallengeMessage = action.payload.message
      state.loginChallengeExpiresInSeconds = action.payload.expiresInSeconds
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true
        state.error = null
        state.registerSuccess = null
      })
      .addCase(login.fulfilled, (state, action: PayloadAction<{ requestId: string; message: string; expiresInSeconds: number }>) => {
        state.loading = false
        state.loginRequestId = action.payload.requestId
        state.loginChallengeMessage = action.payload.message
        state.loginChallengeExpiresInSeconds = action.payload.expiresInSeconds
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(verifyLoginCode.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(verifyLoginCode.fulfilled, (state, action: PayloadAction<{ user: User; tokens: AuthTokens }>) => {
        state.loading = false
        state.user = action.payload.user
        state.tokens = action.payload.tokens
        state.isAuthenticated = true
        state.loginRequestId = null
        state.loginChallengeMessage = null
        state.loginChallengeExpiresInSeconds = null
        localStorage.setItem('user', JSON.stringify(action.payload.user))
        localStorage.setItem('tokens', JSON.stringify(action.payload.tokens))
      })
      .addCase(verifyLoginCode.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(initializeAuth.pending, (state) => {
        state.loading = true
      })
      .addCase(initializeAuth.fulfilled, (state, action: PayloadAction<{ isAuthenticated: boolean; user?: User; tokens?: AuthTokens }>) => {
        state.loading = false
        state.initialized = true
        if (action.payload.isAuthenticated) {
          state.isAuthenticated = true
          state.user = action.payload.user || null
          state.tokens = action.payload.tokens || null
        } else {
          state.isAuthenticated = false
          state.user = null
          state.tokens = null
        }
      })
      .addCase(initializeAuth.rejected, (state) => {
        state.loading = false
        state.initialized = true
        state.isAuthenticated = false
        state.user = null
        state.tokens = null
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
        state.loginRequestId = null
        state.loginChallengeMessage = null
        state.loginChallengeExpiresInSeconds = null
        localStorage.removeItem('user')
        localStorage.removeItem('tokens')
      })
      .addCase(logout.rejected, (state) => {
        state.user = null
        state.tokens = null
        state.isAuthenticated = false
        state.registerSuccess = null
        state.loginRequestId = null
        state.loginChallengeMessage = null
        state.loginChallengeExpiresInSeconds = null
        localStorage.removeItem('user')
        localStorage.removeItem('tokens')
      })
  },
})

export const { clearError, clearLoginChallenge, setLoginChallenge } = authSlice.actions
export default authSlice.reducer
