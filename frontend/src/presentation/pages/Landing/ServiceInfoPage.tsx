import React from 'react'
import { Link } from 'react-router-dom'
import styles from './InfoPage.module.scss'

const ServiceInfoPage: React.FC = () => {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.topBar}>
          <Link to="/" className={styles.backLink}>
            <span className="material-icons-round">arrow_back</span>
            На лендинг
          </Link>
          <div className={styles.tabs}>
            <Link to="/about-service" className={`${styles.tabLink} ${styles.tabLinkActive}`}>О сервисе</Link>
            <Link to="/about-app" className={styles.tabLink}>О приложении</Link>
            <Link to="/docs" className={styles.tabLink}>Документация</Link>
          </div>
        </div>

        <section className={styles.hero}>
          <h1 className={styles.title}>О сервисе АгроАналитика</h1>
          <p className={styles.lead}>
            АгроАналитика — цифровой сервис управления рисками в растениеводстве.
            Он объединяет данные полей, погодные факторы и прогностические модели,
            чтобы агрокоманды принимали решения быстрее и с меньшей неопределенностью.
          </p>
          <div className={styles.stats}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>24/7</div>
              <div className={styles.statLabel}>Мониторинг ситуации по полям</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>7+</div>
              <div className={styles.statLabel}>Сценариев агрорисков под контролем</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>1</div>
              <div className={styles.statLabel}>Единая точка принятия решений</div>
            </div>
          </div>
        </section>

        <div className={styles.grid}>
          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>Задачи, которые решает сервис</h2>
            <ul className={styles.list}>
              <li>Раннее выявление рисков засухи, перегрева и дефицита влаги.</li>
              <li>Планирование поливов на основе текущей и прогнозной ситуации.</li>
              <li>Оценка потенциальной урожайности до начала уборочной кампании.</li>
              <li>Снижение управленческих потерь за счет прозрачной аналитики.</li>
            </ul>
          </section>

          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>Для кого предназначен</h2>
            <ul className={styles.list}>
              <li>Агрономы и полевые специалисты.</li>
              <li>Руководители производственных блоков.</li>
              <li>Собственники и операционные директора хозяйств.</li>
              <li>Аналитики, формирующие отчеты по эффективности.</li>
            </ul>
          </section>

          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>Ценность для бизнеса</h2>
            <p className={styles.text}>
              Сервис помогает переходить от реактивного управления к проактивному:
              команда видит угрозы заранее, принимает корректирующие меры и лучше
              контролирует итоговую урожайность и себестоимость.
            </p>
          </section>

          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>Принципы продукта</h2>
            <ul className={styles.list}>
              <li>Понятный интерфейс для ежедневной работы.</li>
              <li>Практические рекомендации, а не перегрузка данными.</li>
              <li>Единая картина по всем полям и культурам.</li>
              <li>Фокус на действиях, которые влияют на результат.</li>
            </ul>
          </section>
        </div>

        <section className={styles.cta}>
          <p className={styles.ctaText}>
            Хотите посмотреть, как это работает в интерфейсе?
          </p>
          <Link to="/about-app" className={styles.ctaButton}>
            <span className="material-icons-round">apps</span>
            Перейти к странице приложения
          </Link>
        </section>
      </div>
    </div>
  )
}

export default ServiceInfoPage
