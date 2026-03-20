import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@application/store/hooks'
import { login, clearError } from '@application/store/slices/authSlice'
import Button from '@presentation/components/common/Button/Button'
import Input from '@presentation/components/common/Input/Input'
import Alert from '@presentation/components/common/Alert/Alert'
import styles from './LoginPage.module.scss'

const LoginPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { loading, error, isAuthenticated } = useAppSelector(s => s.auth)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (isAuthenticated) navigate('/')
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    dispatch(clearError())
    await dispatch(login({ username, password }))
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={`material-icons-round ${styles.logoIcon}`}>eco</span>
          <h1 className={styles.logoTitle}>АгроАналитика</h1>
          <p className={styles.logoSub}>Центр-Инвест · Предиктивная аналитика</p>
        </div>

        <h2 className={styles.title}>Вход в систему</h2>

        {error && (
          <Alert type="error" onClose={() => dispatch(clearError())}>{error}</Alert>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <Input
            label="Логин"
            icon="person"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Введите логин"
            required
            fullWidth
            autoComplete="username"
          />
          <Input
            label="Пароль"
            icon="lock"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Введите пароль"
            required
            fullWidth
            autoComplete="current-password"
          />
          <Button type="submit" loading={loading} fullWidth size="lg">
            Войти
          </Button>
        </form>

        <p className={styles.hint}>
          Демо-доступ: <strong>admin</strong> / <strong>admin</strong>
        </p>
      </div>
    </div>
  )
}

export default LoginPage
