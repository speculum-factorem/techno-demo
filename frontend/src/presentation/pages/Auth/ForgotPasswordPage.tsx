import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '@presentation/components/common/Button/Button'
import Input from '@presentation/components/common/Input/Input'
import Alert from '@presentation/components/common/Alert/Alert'
import { authApi } from '@infrastructure/api/AuthApi'
import styles from './AuthPage.module.scss'

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [emailConfigured, setEmailConfigured] = useState<boolean | undefined>(undefined)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Введите корректный email')
      return
    }

    setError('')
    setSuccessMsg('')
    setLoading(true)
    try {
      const response = await authApi.forgotPassword(normalizedEmail)
      setSuccessMsg(response.message)
      setEmailConfigured(response.emailConfigured)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при отправке запроса')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      {/* Left decorative panel */}
      <div className={styles.leftPanel}>
        <div className={styles.panelContent}>
          <div className={styles.panelLogo}>
            <span className="material-icons-round">eco</span>
            <span>АгроАналитика</span>
          </div>
          <h2 className={styles.panelTitle}>
            Восстановление доступа
          </h2>
          <ul className={styles.panelFeatures}>
            <li><span className="material-icons-round">lock_reset</span>Безопасный сброс пароля</li>
            <li><span className="material-icons-round">mail</span>Ссылка действует 30 минут</li>
            <li><span className="material-icons-round">security</span>Токен одноразовый</li>
          </ul>
        </div>
      </div>

      {/* Right form panel */}
      <div className={styles.rightPanel}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <span className={`material-icons-round ${styles.formIcon}`} style={{ color: '#f59e0b' }}>lock_reset</span>
            <h1 className={styles.formTitle}>Забыли пароль?</h1>
            <p className={styles.formSub}>Укажите email, и мы отправим ссылку для сброса пароля</p>
          </div>

          {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

          {successMsg && (
            <>
              <Alert type="success">{successMsg}</Alert>
              {emailConfigured === false && (
                <Alert type="warning">
                  SMTP не настроен — письмо не отправлено. Обратитесь к администратору или проверьте логи сервера.
                </Alert>
              )}
            </>
          )}

          {!successMsg && (
            <form onSubmit={handleSubmit} className={styles.form}>
              <Input
                label="Email"
                icon="mail"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@company.ru"
                required
                fullWidth
                autoComplete="email"
              />
              <Button type="submit" loading={loading} fullWidth size="lg">
                Отправить ссылку для сброса
              </Button>
            </form>
          )}

          <p className={styles.switchAuth}>
            Вспомнили пароль? <Link to="/auth/login" className={styles.link}>Войти</Link>
          </p>
          <p className={styles.backLink}>
            <Link to="/" className={styles.link}>
              <span className="material-icons-round">arrow_back</span>
              На главную
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default ForgotPasswordPage  
