import React, { useEffect, useState } from 'react'
import styles from './WorkPlannerPage.module.scss'
import { WorkTask, TaskStatus, TaskPriority, TaskCategory } from '@domain/entities/WorkTask'
import { opsApi } from '@infrastructure/api/OpsApi'

const MOCK_TASKS: WorkTask[] = [
  {
    id: 't1', title: 'Полив пшеничного поля А-1', description: 'Провести плановый полив капельным методом',
    category: 'irrigation', priority: 'high', status: 'in_progress',
    fieldId: 'f1', fieldName: 'Поле А-1 (Пшеница)', assignee: 'Иванов И.И.', assigneeRole: 'operator',
    deadline: '2026-03-21', createdAt: '2026-03-19', updatedAt: '2026-03-20', estimatedHours: 4, actualHours: 2,
    checklist: [
      { id: 'c1', text: 'Проверить давление в системе', done: true },
      { id: 'c2', text: 'Открыть клапаны секций 1-3', done: true },
      { id: 'c3', text: 'Фиксировать расход воды', done: false },
      { id: 'c4', text: 'Закрыть клапаны и сделать отчёт', done: false },
    ],
  },
  {
    id: 't2', title: 'Внесение удобрений Поле Б-2', description: 'NPK удобрения, норма 120 кг/га',
    category: 'fertilization', priority: 'medium', status: 'todo',
    fieldId: 'f2', fieldName: 'Поле Б-2 (Кукуруза)', assignee: 'Петров А.С.', assigneeRole: 'agronomist',
    deadline: '2026-03-22', createdAt: '2026-03-20', updatedAt: '2026-03-20', estimatedHours: 6,
    checklist: [
      { id: 'c5', text: 'Получить удобрения со склада', done: false },
      { id: 'c6', text: 'Настроить разбрасыватель', done: false },
      { id: 'c7', text: 'Внести по схеме', done: false },
    ],
  },
  {
    id: 't3', title: 'Инспекция сенсоров В-3', description: 'Плановая проверка состояния датчиков почвы',
    category: 'inspection', priority: 'low', status: 'done',
    fieldId: 'f3', fieldName: 'Поле В-3 (Подсолнечник)', assignee: 'Сидоров В.Д.', assigneeRole: 'operator',
    deadline: '2026-03-19', createdAt: '2026-03-17', updatedAt: '2026-03-19', estimatedHours: 2, actualHours: 2,
    checklist: [
      { id: 'c8', text: 'Проверить заряд батарей', done: true },
      { id: 'c9', text: 'Сверить показания', done: true },
      { id: 'c10', text: 'Загрузить данные в систему', done: true },
    ],
  },
  {
    id: 't4', title: 'Уборка Поле Г-4', description: 'Уборка ячменя, работа 2 комбайнов',
    category: 'harvesting', priority: 'critical', status: 'overdue',
    fieldId: 'f4', fieldName: 'Поле Г-4 (Ячмень)', assignee: 'Николаев К.Р.', assigneeRole: 'operator',
    deadline: '2026-03-18', createdAt: '2026-03-15', updatedAt: '2026-03-18', estimatedHours: 16,
    checklist: [
      { id: 'c11', text: 'Подготовить комбайны', done: true },
      { id: 'c12', text: 'Начать уборку с северного края', done: false },
      { id: 'c13', text: 'Транспортировка на ток', done: false },
    ],
    notes: 'Задержка из-за поломки комбайна №2',
  },
  {
    id: 't5', title: 'ТО оросительной системы', description: 'Плановое техническое обслуживание',
    category: 'maintenance', priority: 'medium', status: 'todo',
    fieldId: 'f1', fieldName: 'Поле А-1 (Пшеница)', assignee: 'Иванов И.И.', assigneeRole: 'operator',
    deadline: '2026-03-25', createdAt: '2026-03-20', updatedAt: '2026-03-20', estimatedHours: 8,
    checklist: [
      { id: 'c14', text: 'Промыть фильтры', done: false },
      { id: 'c15', text: 'Проверить капельницы', done: false },
      { id: 'c16', text: 'Замена уплотнителей', done: false },
    ],
  },
]

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'К выполнению', in_progress: 'В работе', done: 'Выполнено', overdue: 'Просрочено',
}
const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: '#1a73e8', in_progress: '#f9ab00', done: '#34a853', overdue: '#ea4335',
}
const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Низкий', medium: 'Средний', high: 'Высокий', critical: 'Критический',
}
const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: '#34a853', medium: '#f9ab00', high: '#ea8600', critical: '#ea4335',
}
const CATEGORY_ICONS: Record<TaskCategory, string> = {
  irrigation: 'water_drop', fertilization: 'science', harvesting: 'agriculture',
  inspection: 'search', maintenance: 'build', other: 'task',
}

const WorkPlannerPage: React.FC = () => {
  const [tasks, setTasks] = useState<WorkTask[]>([])
  const [filter, setFilter] = useState<'all' | 'today' | 'overdue' | TaskStatus>('all')
  const [selectedTask, setSelectedTask] = useState<WorkTask | null>(null)
  const [showModal, setShowModal] = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    opsApi.getWorkTasks().then(setTasks).catch(() => setTasks(MOCK_TASKS))
  }, [])

  const filtered = tasks.filter(t => {
    if (filter === 'all') return true
    if (filter === 'today') return t.deadline === today
    if (filter === 'overdue') return t.status === 'overdue'
    return t.status === filter
  })

  const stats = {
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'todo').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length,
    overdue: tasks.filter(t => t.status === 'overdue').length,
  }

  const toggleCheckItem = (taskId: string, itemId: string) => {
    const nextTasks = tasks.map(t =>
      t.id === taskId ? {
        ...t, checklist: t.checklist.map(c => c.id === itemId ? { ...c, done: !c.done } : c)
      } : t
    )
    setTasks(nextTasks)
    const changed = nextTasks.find(t => t.id === taskId)
    if (changed) {
      opsApi.updateWorkTask(taskId, { checklist: changed.checklist }).catch(() => undefined)
    }
    if (selectedTask?.id === taskId) {
      setSelectedTask(prev => prev ? {
        ...prev, checklist: prev.checklist.map(c => c.id === itemId ? { ...c, done: !c.done } : c)
      } : null)
    }
  }

  const doneRatio = (t: WorkTask) => {
    if (!t.checklist.length) return 0
    return Math.round((t.checklist.filter(c => c.done).length / t.checklist.length) * 100)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <span className="material-icons-round">assignment</span>
            Планировщик работ
          </h1>
          <p className={styles.sub}>Задачи для агрономов и механизаторов с контролем исполнения</p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowModal(true)}>
          <span className="material-icons-round">add</span>
          Новая задача
        </button>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        {[
          { label: 'Всего', value: stats.total, color: '#1a73e8', icon: 'list' },
          { label: 'К выполнению', value: stats.todo, color: '#5f6368', icon: 'radio_button_unchecked' },
          { label: 'В работе', value: stats.inProgress, color: '#f9ab00', icon: 'pending' },
          { label: 'Выполнено', value: stats.done, color: '#34a853', icon: 'check_circle' },
          { label: 'Просрочено', value: stats.overdue, color: '#ea4335', icon: 'warning' },
        ].map(s => (
          <div key={s.label} className={styles.statCard} onClick={() => setFilter(s.label === 'Всего' ? 'all' : s.label === 'Просрочено' ? 'overdue' : 'all')}>
            <span className="material-icons-round" style={{ color: s.color, fontSize: 22 }}>{s.icon}</span>
            <span className={styles.statValue} style={{ color: s.color }}>{s.value}</span>
            <span className={styles.statLabel}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        {(['all', 'todo', 'in_progress', 'done', 'overdue'] as const).map(f => (
          <button key={f} className={`${styles.filterBtn} ${filter === f ? styles.activeFilter : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Все' : STATUS_LABELS[f as TaskStatus] || f}
          </button>
        ))}
        <button className={`${styles.filterBtn} ${filter === 'today' ? styles.activeFilter : ''}`} onClick={() => setFilter('today')}>
          Сегодня
        </button>
      </div>

      {/* Task list */}
      <div className={styles.taskList}>
        {filtered.length === 0 && (
          <div className={styles.empty}>
            <span className="material-icons-round">task_alt</span>
            <p>Нет задач в этой категории</p>
          </div>
        )}
        {filtered.map(task => (
          <div key={task.id} className={`${styles.taskCard} ${styles[`priority_${task.priority}`]}`} onClick={() => setSelectedTask(task)}>
            <div className={styles.taskLeft}>
              <span className="material-icons-round" style={{ color: STATUS_COLORS[task.status], fontSize: 20 }}>
                {CATEGORY_ICONS[task.category]}
              </span>
            </div>
            <div className={styles.taskBody}>
              <div className={styles.taskTop}>
                <span className={styles.taskTitle}>{task.title}</span>
                <div className={styles.taskBadges}>
                  <span className={styles.statusBadge} style={{ background: STATUS_COLORS[task.status] + '22', color: STATUS_COLORS[task.status] }}>
                    {STATUS_LABELS[task.status]}
                  </span>
                  <span className={styles.priorityBadge} style={{ background: PRIORITY_COLORS[task.priority] + '22', color: PRIORITY_COLORS[task.priority] }}>
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                </div>
              </div>
              <div className={styles.taskMeta}>
                <span><span className="material-icons-round" style={{ fontSize: 14 }}>grass</span> {task.fieldName}</span>
                <span><span className="material-icons-round" style={{ fontSize: 14 }}>person</span> {task.assignee}</span>
                <span><span className="material-icons-round" style={{ fontSize: 14 }}>schedule</span> до {task.deadline}</span>
                <span><span className="material-icons-round" style={{ fontSize: 14 }}>timer</span> {task.estimatedHours} ч</span>
              </div>
              {task.checklist.length > 0 && (
                <div className={styles.taskProgress}>
                  <div className={styles.progressTrack}>
                    <div className={styles.progressBar} style={{ width: `${doneRatio(task)}%` }} />
                  </div>
                  <span className={styles.progressText}>{task.checklist.filter(c => c.done).length}/{task.checklist.length} пунктов</span>
                </div>
              )}
              {task.notes && (
                <div className={styles.taskNote}>
                  <span className="material-icons-round" style={{ fontSize: 14 }}>info</span>
                  {task.notes}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Task detail modal */}
      {selectedTask && (
        <div className={styles.overlay} onClick={() => setSelectedTask(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <span className="material-icons-round" style={{ color: PRIORITY_COLORS[selectedTask.priority] }}>
                  {CATEGORY_ICONS[selectedTask.category]}
                </span>
                {selectedTask.title}
              </div>
              <button className={styles.closeBtn} onClick={() => setSelectedTask(null)}>
                <span className="material-icons-round">close</span>
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalDesc}>{selectedTask.description}</p>
              <div className={styles.modalGrid}>
                <div className={styles.modalRow}><span>Поле</span><strong>{selectedTask.fieldName}</strong></div>
                <div className={styles.modalRow}><span>Исполнитель</span><strong>{selectedTask.assignee}</strong></div>
                <div className={styles.modalRow}><span>Дедлайн</span><strong>{selectedTask.deadline}</strong></div>
                <div className={styles.modalRow}><span>Оценка</span><strong>{selectedTask.estimatedHours} ч</strong></div>
                {selectedTask.actualHours !== undefined && (
                  <div className={styles.modalRow}><span>Факт</span><strong>{selectedTask.actualHours} ч</strong></div>
                )}
                <div className={styles.modalRow}><span>Приоритет</span>
                  <span className={styles.priorityBadge} style={{ background: PRIORITY_COLORS[selectedTask.priority] + '22', color: PRIORITY_COLORS[selectedTask.priority] }}>
                    {PRIORITY_LABELS[selectedTask.priority]}
                  </span>
                </div>
              </div>

              {selectedTask.checklist.length > 0 && (
                <div className={styles.checklist}>
                  <h3 className={styles.checklistTitle}>Чек-лист</h3>
                  {selectedTask.checklist.map(item => (
                    <label key={item.id} className={styles.checkItem}>
                      <input type="checkbox" checked={item.done}
                        onChange={() => toggleCheckItem(selectedTask.id, item.id)} />
                      <span className={item.done ? styles.checkDone : ''}>{item.text}</span>
                    </label>
                  ))}
                </div>
              )}

              {selectedTask.notes && (
                <div className={styles.modalNote}>
                  <span className="material-icons-round">info</span>
                  {selectedTask.notes}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New task modal stub */}
      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}><span className="material-icons-round">add_task</span> Новая задача</div>
              <button className={styles.closeBtn} onClick={() => setShowModal(false)}><span className="material-icons-round">close</span></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>Название задачи</label>
                <input className={styles.input} placeholder="Введите название..." />
              </div>
              <div className={styles.formGroup}>
                <label>Описание</label>
                <textarea className={styles.textarea} placeholder="Подробное описание..." rows={3} />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Поле</label>
                  <select className={styles.select}>
                    {['Поле А-1', 'Поле Б-2', 'Поле В-3', 'Поле Г-4'].map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Исполнитель</label>
                  <select className={styles.select}>
                    {['Иванов И.И.', 'Петров А.С.', 'Сидоров В.Д.'].map(a => <option key={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Приоритет</label>
                  <select className={styles.select}>
                    {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Дедлайн</label>
                  <input type="date" className={styles.input} defaultValue={today} />
                </div>
              </div>
              <div className={styles.modalActions}>
                <button className={styles.cancelBtn} onClick={() => setShowModal(false)}>Отмена</button>
                <button
                  className={styles.saveBtn}
                  onClick={async () => {
                    const draft: Partial<WorkTask> = {
                      title: 'Новая задача',
                      description: 'Создано из планировщика',
                      category: 'other',
                      priority: 'medium',
                      status: 'todo',
                      fieldId: 'f1',
                      fieldName: 'Поле А-1',
                      assignee: 'Не назначен',
                      assigneeRole: 'operator',
                      deadline: today,
                      checklist: [],
                      estimatedHours: 1,
                    }
                    await opsApi.createWorkTask(draft)
                    const refreshed = await opsApi.getWorkTasks()
                    setTasks(refreshed)
                    setShowModal(false)
                  }}
                >
                  <span className="material-icons-round">save</span> Создать задачу
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WorkPlannerPage
