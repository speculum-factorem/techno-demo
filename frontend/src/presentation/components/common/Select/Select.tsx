import React from 'react'
import styles from './Select.module.scss'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: SelectOption[]
  error?: string
  fullWidth?: boolean
}

const Select: React.FC<SelectProps> = ({ label, options, error, fullWidth, className = '', id, ...props }) => {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className={`${styles.wrapper} ${fullWidth ? styles.fullWidth : ''} ${className}`}>
      {label && <label htmlFor={selectId} className={styles.label}>{label}</label>}
      <div className={`${styles.selectWrapper} ${error ? styles.hasError : ''}`}>
        <select id={selectId} {...props} className={styles.select}>
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <span className={`material-icons-round ${styles.arrow}`}>expand_more</span>
      </div>
      {error && <span className={styles.error}>{error}</span>}
    </div>
  )
}

export default Select
