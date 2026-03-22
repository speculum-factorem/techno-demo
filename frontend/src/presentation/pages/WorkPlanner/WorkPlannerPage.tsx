import React, { useCallback, useEffect, useState } from 'react'
import styles from './WorkPlannerPage.module.scss'
import { WorkTask, TaskStatus, TaskPriority, TaskCategory, ChecklistItem } from '@domain/entities/WorkTask'
import { opsApi } from '@infrastructure/api/OpsApi'
import { fieldApi } from '@infrastructure/api/FieldApi'
import type { Field } from '@domain/entities/Field'

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
const CATEGORY_LABELS: Record<TaskCategory, string> = {
  irrigation: 'Полив', fertilization: 'Удобрения', harvesting: 'Уборка',
  inspection: 'Инспекция', maintenance: 'Обслуживание', other: 'Прочее',
}

function parseChecklistFromText(raw: string): ChecklistItem[] {
  const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  const base = Date.now()
  return lines.map((text, i) => ({
    id: `c_${base}_${i}`,
    text,
    done: false,
  }))
}

function apiErr(e: unknown, fallback: string): string {
  const ex = e as { response?: { data?: { detail?: unknown; message?: string } } }
  const d = ex.response?.data
  const detail = d?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail) && detail[0] && typeof (detail[0] as { msg?: string }).msg === 'string') {
    return (detail[0] as { msg: string }).msg
  }
  const msg = d?.message
  if (typeof msg === 'string' && msg.trim()) return msg
  return fallback
}

const WorkPlannerPage: React.FC = () => {
  const [tasks, setTasks] = useState<WorkTask[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'today' | 'overdue' | TaskStatus>('all')
  const [selectedTask, setSelectedTask] = useState<WorkTask | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [fields, setFields] = useState<Field[]>([])
  const [fieldsLoadError, setFieldsLoadError] = useState<string | null>(null)

  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newCategory, setNewCategory] = useState<TaskCategory>('other')
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium')
  const [newFieldId, setNewFieldId] = useState('')
  const [newFieldNameManual, setNewFieldNameManual] = useState('')
  const [newAssignee, setNewAssignee] = useState('')
  const [newAssigneeRole, setNewAssigneeRole] = useState<'agronomist' | 'operator' | 'manager'>('operator')
  const [newDeadline, setNewDeadline] = useState('')
  const [newEstimatedHours, setNewEstimatedHours] = useState(2)
  const [newNotes, setNewNotes] = useState('')
  const [newChecklistText, setNewChecklistText] = useState('')
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createFormError, setCreateFormError] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)

  const loadTasks = useCallback(async () => {
    setListError(null)
    try {
      const list = await opsApi.getWorkTasks()
      setTasks(list)
    } catch {
      setTasks([])
      setListError('Не удалось загрузить задачи. Проверьте API и авторизацию.')
    }
  }, [])

  useEffect(() => {
    void loadTasks()
  }, [loadTasks])

  useEffect(() => {
    if (showModal && fields.length > 0 && !fields.some(f => f.id === newFieldId)) {
      setNewFieldId(fields[0].id)
    }
  }, [showModal, fields, newFieldId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await fieldApi.getAll()
        if (!cancelled) {
          setFields(list)
          setFieldsLoadError(null)
        }
      } catch {
        if (!cancelled) {
          setFields([])
          setFieldsLoadError('Поля не загружены — укажите ID и название поля вручную.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const openCreateModal = () => {
    setNewTitle('')
    setNewDescription('')
    setNewCategory('other')
    setNewPriority('medium')
    setNewFieldId(fields[0]?.id ?? '')
    setNewFieldNameManual('')
    setNewAssignee('')
    setNewAssigneeRole('operator')
    setNewDeadline(today)
    setNewEstimatedHours(2)
    setNewNotes('')
    setNewChecklistText('')
    setCreateFormError(null)
    setShowModal(true)
  }

  const closeCreateModal = () => {
    if (!createSubmitting) setShowModal(false)
  }

  const submitNewTask = async () => {
    setCreateFormError(null)
    if (!newTitle.trim()) {
      setCreateFormError('Введите название задачи')
      return
    }
    let fieldId: string
    let fieldName: string
    if (fields.length > 0) {
      const field = fields.find(f => f.id === newFieldId)
      if (!field) {
        setCreateFormError('Выберите поле из списка')
        return
      }
      fieldId = field.id
      fieldName = field.name
    } else {
      fieldId = newFieldId.trim() || 'f1'
      fieldName = newFieldNameManual.trim()
      if (!newFieldId.trim()) {
        setCreateFormError('Укажите ID поля')
        return
      }
      if (!fieldName) {
        setCreateFormError('Укажите название поля')
        return
      }
    }

    const checklist = parseChecklistFromText(newChecklistText)

    setCreateSubmitting(true)
    try {
      await opsApi.createWorkTask({
        title: newTitle.trim(),
        description: newDescription.trim() || '—',
        category: newCategory,
        priority: newPriority,
        status: 'todo',
        fieldId,
        fieldName,
        assignee: newAssignee.trim() || 'Не назначен',
        assigneeRole: newAssigneeRole,
        deadline: newDeadline || today,
        estimatedHours: Math.max(0.25, Number(newEstimatedHours) || 1),
        checklist,
        notes: newNotes.trim() || undefined,
      })
      await loadTasks()
      setShowModal(false)
    } catch (e) {
      setCreateFormError(apiErr(e, 'Не удалось создать задачу'))
    } finally {
      setCreateSubmitting(false)
    }
  }

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
        <button type="button" className={styles.addBtn} onClick={openCreateModal}>
          <span className="material-icons-round">add</span>
          Новая задача
        </button>
      </div>

      {listError && (
        <div className={styles.infoMsg} style={{ borderColor: '#ea4335', background: '#fce8e6', marginBottom: 16 }}>
          <span className="material-icons-round" style={{ color: '#ea4335' }}>error_outline</span>
          {listError}
        </div>
      )}

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
          <button key={f} type="button" className={`${styles.filterBtn} ${filter === f ? styles.activeFilter : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Все' : STATUS_LABELS[f as TaskStatus] || f}
          </button>
        ))}
        <button type="button" className={`${styles.filterBtn} ${filter === 'today' ? styles.activeFilter : ''}`} onClick={() => setFilter('today')}>
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
              <button type="button" className={styles.closeBtn} onClick={() => setSelectedTask(null)}>
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

      {showModal && (
        <div className={styles.overlay} onClick={closeCreateModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}><span className="material-icons-round">add_task</span> Новая задача</div>
              <button type="button" className={styles.closeBtn} disabled={createSubmitting} onClick={closeCreateModal}>
                <span className="material-icons-round">close</span>
              </button>
            </div>
            <div className={styles.modalBody}>
              {fieldsLoadError && (
                <div className={styles.infoMsg} style={{ borderColor: '#f9ab00', background: '#fff8e1' }}>
                  <span className="material-icons-round" style={{ color: '#f9ab00' }}>warning</span>
                  {fieldsLoadError}
                </div>
              )}
              {createFormError && (
                <div className={styles.infoMsg} style={{ borderColor: '#ea4335', background: '#fce8e6' }}>
                  <span className="material-icons-round" style={{ color: '#ea4335' }}>error_outline</span>
                  {createFormError}
                </div>
              )}
              <div className={styles.formGroup}>
                <label>Название задачи</label>
                <input className={styles.input} value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Например, Полив секции 2" />
              </div>
              <div className={styles.formGroup}>
                <label>Описание</label>
                <textarea className={styles.textarea} value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Подробности для исполнителя" rows={3} />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Категория</label>
                  <select className={styles.select} value={newCategory} onChange={e => setNewCategory(e.target.value as TaskCategory)}>
                    {(Object.keys(CATEGORY_LABELS) as TaskCategory[]).map(c => (
                      <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Приоритет</label>
                  <select className={styles.select} value={newPriority} onChange={e => setNewPriority(e.target.value as TaskPriority)}>
                    {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map(k => (
                      <option key={k} value={k}>{PRIORITY_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
              </div>
              {fields.length > 0 ? (
                <div className={styles.formGroup}>
                  <label>Поле</label>
                  <select className={styles.select} value={newFieldId} onChange={e => setNewFieldId(e.target.value)}>
                    {fields.map(f => (
                      <option key={f.id} value={f.id}>{f.name} ({f.id})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>ID поля</label>
                    <input className={styles.input} value={newFieldId} onChange={e => setNewFieldId(e.target.value)} placeholder="f1" />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Название поля</label>
                    <input className={styles.input} value={newFieldNameManual} onChange={e => setNewFieldNameManual(e.target.value)} placeholder="Поле А-1" />
                  </div>
                </div>
              )}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Исполнитель (ФИО)</label>
                  <input className={styles.input} value={newAssignee} onChange={e => setNewAssignee(e.target.value)} placeholder="Иванов И.И." />
                </div>
                <div className={styles.formGroup}>
                  <label>Роль исполнителя</label>
                  <select className={styles.select} value={newAssigneeRole} onChange={e => setNewAssigneeRole(e.target.value as 'agronomist' | 'operator' | 'manager')}>
                    <option value="operator">Механизатор</option>
                    <option value="agronomist">Агроном</option>
                    <option value="manager">Менеджер</option>
                  </select>
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Дедлайн</label>
                  <input type="date" className={styles.input} value={newDeadline} onChange={e => setNewDeadline(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label>Оценка, ч</label>
                  <input type="number" className={styles.input} min={0.25} step={0.5} value={newEstimatedHours} onChange={e => setNewEstimatedHours(Number(e.target.value))} />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Чек-лист (по одному пункту в строке, необязательно)</label>
                <textarea className={styles.textarea} value={newChecklistText} onChange={e => setNewChecklistText(e.target.value)} placeholder="Проверить оборудование&#10;Согласовать время" rows={3} />
              </div>
              <div className={styles.formGroup}>
                <label>Заметки (необязательно)</label>
                <input className={styles.input} value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Комментарий для планировщика" />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} disabled={createSubmitting} onClick={closeCreateModal}>Отмена</button>
                <button type="button" className={styles.saveBtn} disabled={createSubmitting} onClick={() => void submitNewTask()}>
                  <span className="material-icons-round">save</span>
                  {createSubmitting ? 'Создание…' : 'Создать задачу'}
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
