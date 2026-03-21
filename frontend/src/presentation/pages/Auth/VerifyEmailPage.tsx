import React, { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { authApi } from '@infrastructure/api/AuthApi'
import Alert from '@presentation/components/common/Alert/Alert'
import Button from '@presentation/components/common/Button/Button'
import Input from '@presentation/components/common/Input/Input'
import styles from './LoginPage.module.scss'

const VerifyEmailPage: React.FC = () => {
  const [params] = useSearchParams()
  const location = useLocation()
  const emailHint = (location.state as { email?: string } | null)?.email

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [code, setCode] = useState('')

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      setStatus('idle')
      setMessage('')
      return
    }

    setStatus('loading')
    setMessage('Подтверждаем email по ссылке...')

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

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault()
    const digits = code.replace(/\D/g, '')
    if (digits.length !== 6) {
      setStatus('error')
      setMessage('Введите 6 цифр кода из письма')
      return
    }
    setStatus('loading')
    setMessage('')
    try {
      if (!emailHint) {
        setStatus('error')
        setMessage('Не удалось определить email. Зарегистрируйтесь заново или используйте ссылку из письма.')
        return
      }
      const res = await authApi.verifyEmailWithCode(emailHint, digits)
      setStatus('success')
      setMessage(res.message)
    } catch (err: any) {
      setStatus('error')
      setMessage(err.response?.data?.message || err.response?.data?.detail || 'Неверный или просроченный код')
    }
  }

  const showCodeForm = !params.get('token')

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h2 className={styles.title}>Подтверждение email</h2>

        {params.get('token') && status === 'loading' && <Alert type="info">{message}</Alert>}
        {params.get('token') && status === 'success' && <Alert type="success">{message}</Alert>}
        {params.get('token') && status === 'error' && <Alert type="error">{message}</Alert>}

        {showCodeForm && status !== 'success' && (
          <>
            <p className={styles.verifyHint}>
              На указанный при регистрации адрес отправлено письмо с <strong>6-значным кодом</strong>.
              Введите его ниже.
            </p>
            {emailHint && (
              <p className={styles.verifyEmailHint}>
                Письмо отправлено на: <strong>{emailHint}</strong>
              </p>
            )}
            <form onSubmit={submitCode} className={styles.verifyForm}>
              <Input
                label="Код из письма"
                icon="pin"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                fullWidth
                hint="Только цифры, без пробелов"
              />
              <Button type="submit" fullWidth loading={status === 'loading'} disabled={code.replace(/\D/g, '').length !== 6}>
                Подтвердить
              </Button>
            </form>
            {status === 'error' && message && <Alert type="error">{message}</Alert>}
          </>
        )}
        {showCodeForm && status === 'success' && <Alert type="success">{message}</Alert>}

        <p className={styles.switchAuth}>
          <Link to="/auth/login" className={styles.link}>Перейти ко входу</Link>
        </p>
      </div>
    </div>
  )
}

export default VerifyEmailPage
