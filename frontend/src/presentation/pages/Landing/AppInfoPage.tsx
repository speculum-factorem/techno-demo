import React from 'react'
import { Link } from 'react-router-dom'
import styles from './InfoPage.module.scss'

const AppInfoPage: React.FC = () => {
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
            <Link to="/about-app" className={`${styles.tabLink} ${styles.tabLinkActive}`}>О приложении</Link>
            <Link to="/docs" className={styles.tabLink}>Документация</Link>
          </div>
        </div>

        <section className={styles.hero}>
          <h1 className={styles.title}>О приложении АгроАналитика</h1>
          <p className={styles.lead}>
            Приложение — это рабочее пространство агрокоманды: от обзорного дашборда до
            детальных модулей по полям, поливу, погоде и отчетности.
          </p>
          <div className={styles.stats}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>10+</div>
              <div className={styles.statLabel}>Пользовательских экранов</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>1 клик</div>
              <div className={styles.statLabel}>До ключевых KPI по хозяйству</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>0</div>
              <div className={styles.statLabel}>Лишних переходов для критичных действий</div>
            </div>
          </div>
        </section>

        <div className={styles.grid}>
          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>Ключевые экраны</h2>
            <ul className={styles.list}>
              <li>Дашборд состояния полей и активных рисков.</li>
              <li>Карточки полей с культурой, площадью и историей изменений.</li>
              <li>Модули прогноза урожайности и орошения.</li>
              <li>Погодный мониторинг и предупреждения.</li>
              <li>Отчеты и экспорт для управленческих решений.</li>
            </ul>
          </section>

          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>Пользовательские сценарии</h2>
            <ul className={styles.list}>
              <li>Ежедневный контроль состояния хозяйства.</li>
              <li>Подготовка плана поливов на неделю.</li>
              <li>Проверка рисков перед ключевыми фазами роста культур.</li>
              <li>Оперативная реакция на уведомления и аномалии.</li>
            </ul>
          </section>

          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>Почему с приложением проще</h2>
            <p className={styles.text}>
              Интерфейс проектировался для практической работы в сезон: минимум лишних действий,
              логичная навигация и приоритет на данных, которые требуют решения прямо сейчас.
            </p>
          </section>

          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>Командная работа</h2>
            <p className={styles.text}>
              Приложение поддерживает разные роли пользователей: каждый участник команды
              получает нужный уровень доступа и видит релевантную ему часть процесса.
            </p>
          </section>
        </div>

        <section className={styles.cta}>
          <p className={styles.ctaText}>
            Нужна подробная пользовательская документация по функциям?
          </p>
          <Link to="/docs" className={styles.ctaButton}>
            <span className="material-icons-round">menu_book</span>
            Открыть документацию
          </Link>
        </section>
      </div>
    </div>
  )
}

export default AppInfoPage
