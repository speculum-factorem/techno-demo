import React from 'react'
import styles from './Button.module.scss'

type ButtonVariant = 'primary' | 'secondary' | 'outlined' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: string
  iconEnd?: string
  loading?: boolean
  fullWidth?: boolean
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconEnd,
  loading,
  fullWidth,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`${styles.btn} ${styles[variant]} ${styles[size]} ${fullWidth ? styles.fullWidth : ''} ${className}`}
    >
      {loading ? (
        <span className={styles.spinner} />
      ) : icon ? (
        <span className="material-icons-round">{icon}</span>
      ) : null}
      {children}
      {iconEnd && !loading && <span className="material-icons-round">{iconEnd}</span>}
    </button>
  )
}

export default Button
