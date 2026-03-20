import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '@infrastructure/api/AuthApi'
import Alert from '@presentation/components/common/Alert/Alert'
import styles from './LoginPage.module.scss'

const VerifyEmailPage: React.FC = () => {
  const [params] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Подтверждаем email...')

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      setStatus('error')
      setMessage('Не найден token подтверждения')
      return
    }

    authApi.verifyEmail(token)
      .then((res) => {
        setStatus('success')
        setMessage(res.message)
      })
      .catch((err) => {
        setStatus('error')
        setMessage(err.response?.data?.message || 'Не удалось подтвердить email')
      })
  }, [params])

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h2 className={styles.title}>Подтверждение email</h2>
        {status === 'loading' && <Alert type="info">{message}</Alert>}
        {status === 'success' && <Alert type="success">{message}</Alert>}
        {status === 'error' && <Alert type="error">{message}</Alert>}
        <p className={styles.switchAuth}>
          <Link to="/auth/login" className={styles.link}>Перейти ко входу</Link>
        </p>
      </div>
    </div>
  )
}

export default VerifyEmailPage
