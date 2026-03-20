import React from 'react'
import styles from './Loader.module.scss'

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  fullPage?: boolean
}

const Loader: React.FC<LoaderProps> = ({ size = 'md', text, fullPage }) => {
  const content = (
    <div className={styles.wrapper}>
      <div className={`${styles.spinner} ${styles[size]}`}>
        <div className={styles.ring} />
      </div>
      {text && <p className={styles.text}>{text}</p>}
    </div>
  )

  if (fullPage) {
    return <div className={styles.fullPage}>{content}</div>
  }

  return content
}

export default Loader
