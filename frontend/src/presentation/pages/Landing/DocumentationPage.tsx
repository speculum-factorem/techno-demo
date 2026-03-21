import React from 'react'
import { Link } from 'react-router-dom'
import styles from './InfoPage.module.scss'

const DocumentationPage: React.FC = () => {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.topBar}>
          <Link to="/" className={styles.backLink}>
            <span className="material-icons-round">arrow_back</span>
            На лендинг
          </Link>
          <div className={styles.tabs}>
            <Link to="/about-service" className={styles.tabLink}>О сервисе</Link>
            <Link to="/about-app" className={styles.tabLink}>О приложении</Link>
            <Link to="/docs" className={`${styles.tabLink} ${styles.tabLinkActive}`}>Документация</Link>
          </div>
        </div>

        <section className={styles.hero}>
          <h1 className={styles.title}>Документация по функционалу</h1>
          <p className={styles.lead}>
            Ниже описаны ключевые возможности приложения с точки зрения пользователя:
            какие задачи решает каждый модуль и в каких рабочих сценариях он применяется.
          </p>
        </section>

        <div className={styles.grid}>
          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>1. Дашборд</h2>
            <ul className={styles.list}>
              <li>Показывает сводную картину по полям, рискам и активности.</li>
              <li>Позволяет быстро определить приоритетные участки для проверки.</li>
              <li>Используется для ежедневного оперативного контроля.</li>
            </ul>
          </section>

          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>2. Поля и культуры</h2>
            <ul className={styles.list}>
              <li>Хранит реестр полей с основными характеристиками.</li>
              <li>Позволяет вести учет культур и ключевых параметров.</li>
              <li>Используется как базовый слой для аналитики и прогнозов.</li>
            </ul>
          </section>

          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>3. Прогноз урожайности</h2>
            <ul className={styles.list}>
              <li>Предоставляет оценку ожидаемой урожайности по полям.</li>
              <li>Помогает планировать агропроцессы и загрузку ресурсов.</li>
              <li>Позволяет сравнивать сценарии и корректировать планы.</li>
            </ul>
          </section>

          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>4. Рекомендации по поливу</h2>
            <ul className={styles.list}>
              <li>Подсказывает приоритеты полива и ожидаемую потребность во влаге.</li>
              <li>Снижает риск как переувлажнения, так и дефицита воды.</li>
              <li>Помогает распределять воду и технику по участкам.</li>
            </ul>
          </section>

          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>5. Погода и события</h2>
            <ul className={styles.list}>
              <li>Отображает актуальные погодные условия и тренды.</li>
              <li>Поддерживает планирование полевых работ с учетом прогноза.</li>
              <li>Сигнализирует о погодных факторах, влияющих на урожай.</li>
            </ul>
          </section>

          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>6. Алерты и уведомления</h2>
            <ul className={styles.list}>
              <li>Фиксирует события, требующие внимания команды.</li>
              <li>Помогает быстро реагировать на критичные изменения.</li>
              <li>Поддерживает приоритизацию действий в течение дня.</li>
            </ul>
          </section>

          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>7. Отчеты</h2>
            <ul className={styles.list}>
              <li>Собирает данные по ключевым показателям за период.</li>
              <li>Поддерживает управленческую аналитику и сравнение сезонов.</li>
              <li>Упрощает коммуникацию между агрономами и руководством.</li>
            </ul>
          </section>

          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>8. Роли и доступы</h2>
            <ul className={styles.list}>
              <li>Разделяет функционал для разных категорий пользователей.</li>
              <li>Ограничивает доступ к чувствительным действиям и данным.</li>
              <li>Обеспечивает безопасную командную работу.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}

export default DocumentationPage
