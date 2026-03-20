import React from 'react'
import styles from './Alert.module.scss'

type AlertType = 'success' | 'warning' | 'error' | 'info'

interface AlertProps {
  type?: AlertType
  title?: string
  children: React.ReactNode
  onClose?: () => void
}

const icons: Record<AlertType, string> = {
  success: 'check_circle',
  warning: 'warning',
  error: 'error',
  info: 'info',
}

const Alert: React.FC<AlertProps> = ({ type = 'info', title, children, onClose }) => {
  return (
    <div className={`${styles.alert} ${styles[type]}`}>
      <span className={`material-icons-round ${styles.icon}`}>{icons[type]}</span>
      <div className={styles.content}>
        {title && <div className={styles.title}>{title}</div>}
        <div className={styles.message}>{children}</div>
      </div>
      {onClose && (
        <button className={styles.close} onClick={onClose} aria-label="Закрыть">
          <span className="material-icons-round">close</span>
        </button>
      )}
    </div>
  )
}

export default Alert
