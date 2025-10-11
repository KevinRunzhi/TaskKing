// 任务数据模型和工具函数

// 优先级常量
const PRIORITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
}

// 重复频率常量
const RECURRENCE_TYPES = {
  NONE: 'none',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  CUSTOM: 'custom'
}

// 优先级标签
const PRIORITY_LABELS = {
  [PRIORITY.HIGH]: '高',
  [PRIORITY.MEDIUM]: '中',
  [PRIORITY.LOW]: '低'
}

// 优先级数值（用于排序）
const PRIORITY_VALUES = {
  [PRIORITY.HIGH]: 3,
  [PRIORITY.MEDIUM]: 2,
  [PRIORITY.LOW]: 1
}

const DEFAULT_THRESHOLD = 50
const URGENCY_FALLBACK = 40

function clampScore(value) {
  const number = Number(value)
  if (Number.isNaN(number)) {
    return 0
  }
  if (number < 0) {
    return 0
  }
  if (number > 100) {
    return 100
  }
  return Math.round(number)
}

function inferImportanceScore(priority = PRIORITY.MEDIUM) {
  switch (priority) {
    case PRIORITY.HIGH:
      return 85
    case PRIORITY.LOW:
      return 35
    default:
      return 60
  }
}

function inferUrgencyScore(dueDateTime = '') {
  if (!dueDateTime) {
    return URGENCY_FALLBACK
  }

  const parsed = new Date(dueDateTime)
  if (Number.isNaN(parsed.getTime())) {
    return URGENCY_FALLBACK
  }

  const now = Date.now()
  const diffHours = (parsed.getTime() - now) / (1000 * 60 * 60)

  if (diffHours <= 12) {
    return 90
  }
  if (diffHours <= 24) {
    return 75
  }
  if (diffHours <= 72) {
    return 60
  }
  if (diffHours <= 168) {
    return 45
  }
  return 30
}

function getQuadrantFromScores(importanceScore = 0, urgencyScore = 0, threshold = DEFAULT_THRESHOLD) {
  const important = importanceScore >= threshold
  const urgent = urgencyScore >= threshold

  if (important && urgent) {
    return 1
  }
  if (important && !urgent) {
    return 2
  }
  if (!important && urgent) {
    return 3
  }
  return 4
}

function getQuadrantRecommendation(importanceScore = 0, urgencyScore = 0) {
  switch (getQuadrantFromScores(importanceScore, urgencyScore)) {
    case 1:
      return '立即处理'
    case 2:
      return '计划安排'
    case 3:
      return '尽量委托'
    default:
      return '可以舍弃'
  }
}

function parseDateParts(dateString) {
  if (!dateString) return null
  const parts = dateString.split('-')
  if (parts.length !== 3) return null

  const [year, month, day] = parts.map(Number)
  if ([year, month, day].some(value => Number.isNaN(value))) {
    return null
  }

  return { year, month, day }
}

function parseTimeParts(timeString = '00:00') {
  if (!timeString) {
    return { hour: 0, minute: 0 }
  }

  const parts = timeString.split(':')
  if (parts.length < 2) return null

  const hour = Number(parts[0])
  const minute = Number(parts[1])

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null
  }

  return { hour, minute }
}

function createDateTime(dateString, timeString = '00:00') {
  const dateParts = parseDateParts(dateString)
  if (!dateParts) return null

  const timeParts = parseTimeParts(timeString)
  if (!timeParts) return null

  return new Date(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    timeParts.hour,
    timeParts.minute,
    0,
    0
  )
}

function toISODateTime(dateString, timeString = '00:00') {
  const date = createDateTime(dateString, timeString)
  return date ? date.toISOString() : ''
}

function splitISODateTime(isoString) {
  if (!isoString) {
    return {
      date: '',
      time: ''
    }
  }

  const datetime = new Date(isoString)
  if (Number.isNaN(datetime.getTime())) {
    return {
      date: '',
      time: ''
    }
  }

  const year = datetime.getFullYear()
  const month = String(datetime.getMonth() + 1).padStart(2, '0')
  const day = String(datetime.getDate()).padStart(2, '0')
  const hour = String(datetime.getHours()).padStart(2, '0')
  const minute = String(datetime.getMinutes()).padStart(2, '0')

  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`
  }
}

function getDueDateObject(task) {
  if (!task) return null

  if (task.dueDateTime) {
    const date = new Date(task.dueDateTime)
    if (!Number.isNaN(date.getTime())) {
      return date
    }
  }

  if (task.dueDate) {
    const date = createDateTime(task.dueDate, task.dueTime || '23:59')
    if (date) {
      return date
    }
  }

  return null
}

function normalizeWeekdays(weekdays) {
  if (!Array.isArray(weekdays)) return []

  const set = new Set()
  weekdays.forEach(value => {
    const number = Number(value)
    if (!Number.isNaN(number) && number >= 0 && number <= 6) {
      set.add(number)
    }
  })

  return Array.from(set).sort((a, b) => a - b)
}

function isValidDateString(dateString) {
  const parts = parseDateParts(dateString)
  if (!parts) return false

  const { year, month, day } = parts
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

// 创建新任务
function createTask(
  titleOrData,
  description = '',
  dueDate = '',
  priority = PRIORITY.MEDIUM
) {
  const data =
    typeof titleOrData === 'object' && titleOrData !== null
      ? titleOrData
      : {
          title: titleOrData,
          description,
          dueDate,
          priority
        }

  const trimmedTitle = (data.title || '').trim()
  const trimmedDescription = (data.description || '').trim()
  const dueDateValue = data.dueDate || ''
  const dueTimeValue = data.dueTime || ''
  const categoryIdValue = (data.categoryId || '').toString()

  const reminderEnabled = !!data.reminderEnabled
  const reminderDateValue = data.reminderDate || ''
  const reminderTimeValue = data.reminderTime || ''

  const dueDateTimeValue = dueDateValue
    ? toISODateTime(dueDateValue, dueTimeValue || '23:59')
    : ''

  const reminderDateTimeValue =
    reminderEnabled && reminderDateValue && reminderTimeValue
      ? toISODateTime(reminderDateValue, reminderTimeValue)
      : ''

  const recurrenceEnabled = !!data.recurrenceEnabled
  const recurrenceTypeValue = recurrenceEnabled
    ? data.recurrenceType || RECURRENCE_TYPES.DAILY
    : RECURRENCE_TYPES.NONE
  const recurrenceIntervalValue = recurrenceEnabled
    ? Math.max(1, Number.parseInt(data.recurrenceInterval, 10) || 1)
    : 1
  const recurrenceEndDateValue = recurrenceEnabled ? data.recurrenceEndDate || '' : ''
  const recurrenceWeekdaysValue = recurrenceEnabled
    ? normalizeWeekdays(data.recurrenceWeekdays)
    : []
  const recurrenceSeriesIdValue = recurrenceEnabled
    ? (data.recurrenceSeriesId || '')
    : ''
  const recurrenceOccurrenceValue = recurrenceEnabled
    ? Math.max(1, Number.parseInt(data.recurrenceOccurrence, 10) || 1)
    : 0
  const recurrenceStatusValue = recurrenceEnabled ? 'active' : 'inactive'

  const importanceScoreValue = clampScore(
    Object.prototype.hasOwnProperty.call(data, 'importanceScore')
      ? data.importanceScore
      : inferImportanceScore(data.priority || PRIORITY.MEDIUM)
  )

  const urgencyScoreValue = clampScore(
    Object.prototype.hasOwnProperty.call(data, 'urgencyScore')
      ? data.urgencyScore
      : inferUrgencyScore(dueDateTimeValue)
  )

  const quadrantRecommendationValue = getQuadrantRecommendation(
    importanceScoreValue,
    urgencyScoreValue
  )

  const tagsValue = Array.isArray(data.tags)
    ? data.tags
        .map(tag => (typeof tag === 'string' ? tag.trim() : String(tag || '').trim()))
        .filter(tag => !!tag)
    : []

  return {
    id: '',
    title: trimmedTitle,
    description: trimmedDescription,
    dueDate: dueDateValue,
    dueTime: dueTimeValue,
    dueDateTime: dueDateTimeValue,
    priority: data.priority || PRIORITY.MEDIUM,
    importanceScore: importanceScoreValue,
    urgencyScore: urgencyScoreValue,
    tags: tagsValue,
    categoryId: categoryIdValue,
    reminderEnabled,
    reminderDate: reminderDateValue,
    reminderTime: reminderTimeValue,
    reminderDateTime: reminderDateTimeValue,
    reminderStatus: reminderEnabled ? 'pending' : 'disabled',
    recurrenceEnabled,
    recurrenceType: recurrenceTypeValue,
    recurrenceInterval: recurrenceIntervalValue,
    recurrenceEndDate: recurrenceEndDateValue,
    recurrenceWeekdays: recurrenceWeekdaysValue,
    recurrenceSeriesId: recurrenceSeriesIdValue,
    recurrenceOccurrence: recurrenceOccurrenceValue,
    recurrenceStatus: recurrenceStatusValue,
    completed: !!data.completed,
    completedAt: data.completed
      ? (() => {
          const provided = data.completedAt || data.updatedAt || data.createdAt
          if (provided) {
            const parsed = new Date(provided)
            if (!Number.isNaN(parsed.getTime())) {
              return parsed.toISOString()
            }
          }
          return new Date().toISOString()
        })()
      : '',
    createdAt: '',
    updatedAt: new Date().toISOString(),
    quadrantRecommendation: quadrantRecommendationValue
  }
}

// 验证任务数据
function validateTask(task) {
  const errors = []

  const title = (task.title || '').trim()
  const description = task.description || ''
  const priority = task.priority
  const categoryId = (task.categoryId || '').toString().trim()

  if (!title) {
    errors.push('任务标题不能为空')
  }

  if (title.length > 100) {
    errors.push('任务标题不能超过100个字符')
  }

  if (description && description.length > 500) {
    errors.push('任务描述不能超过500个字符')
  }

  if (!Object.values(PRIORITY).includes(priority)) {
    errors.push('无效的优先级')
  }

  if (!categoryId) {
    errors.push('请选择任务分类')
  }

  const now = new Date()
  let dueDateTime = null

  if (task.dueDate) {
    dueDateTime = createDateTime(task.dueDate, task.dueTime || '23:59')

    if (!dueDateTime) {
      errors.push('无效的截止日期或时间')
    } else if (dueDateTime.getTime() < now.getTime()) {
      errors.push('截止时间不能早于当前时间')
    }
  } else if (task.dueTime) {
    errors.push('请选择截止日期')
  }

  if (task.reminderEnabled) {
    if (!task.reminderDate || !task.reminderTime) {
      errors.push('请完整选择提醒日期和时间')
    } else {
      const reminderDateTime = createDateTime(
        task.reminderDate,
        task.reminderTime
      )

      if (!reminderDateTime) {
        errors.push('无效的提醒时间')
      } else if (reminderDateTime.getTime() < now.getTime()) {
        errors.push('提醒时间不能早于当前时间')
      } else if (dueDateTime && reminderDateTime.getTime() > dueDateTime.getTime()) {
        errors.push('提醒时间不能晚于截止时间')
      }
    }
  }

  if (task.recurrenceEnabled) {
    const recurrenceType = task.recurrenceType || RECURRENCE_TYPES.NONE
    if (!Object.values(RECURRENCE_TYPES).includes(recurrenceType) || recurrenceType === RECURRENCE_TYPES.NONE) {
      errors.push('请选择重复频率')
    }

    const interval = Number.parseInt(task.recurrenceInterval, 10)
    if (!Number.isInteger(interval) || interval < 1) {
      errors.push('重复间隔必须是正整数')
    }

    if (!task.dueDate) {
      errors.push('重复任务需要设置截止日期')
    }

    if (task.recurrenceEndDate) {
      if (!isValidDateString(task.recurrenceEndDate)) {
        errors.push('无效的重复结束日期')
      } else {
        const endDate = createDateTime(task.recurrenceEndDate, '23:59')
        const firstDate = dueDateTime || createDateTime(task.dueDate, task.dueTime || '00:00')
        if (endDate && firstDate && endDate.getTime() < firstDate.getTime()) {
          errors.push('重复结束日期不能早于首次截止日期')
        }
      }
    }

    if (
      (recurrenceType === RECURRENCE_TYPES.WEEKLY || recurrenceType === RECURRENCE_TYPES.CUSTOM) &&
      normalizeWeekdays(task.recurrenceWeekdays).length === 0
    ) {
      errors.push('请选择重复的星期')
    }
  }

  return errors
}

// 格式化日期显示
function formatDate(dateString, timeString = '') {
  if (!dateString) return ''

  const referenceDate = createDateTime(dateString, timeString || '00:00')
  if (!referenceDate) return ''

  const today = new Date()
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    0,
    0,
    0,
    0
  )
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)

  const referenceStart = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    0,
    0,
    0,
    0
  )

  let label
  if (referenceStart.getTime() === todayStart.getTime()) {
    label = '今天'
  } else if (referenceStart.getTime() === tomorrowStart.getTime()) {
    label = '明天'
  } else {
    label = `${referenceDate.getMonth() + 1}/${referenceDate.getDate()}`
  }

  if (timeString) {
    label += ` ${timeString}`
  }

  return label
}

// 检查任务是否过期
function isOverdue(dateString, timeString = '', dateTimeString = '') {
  const now = new Date()

  let dueDate = null
  if (dateTimeString) {
    const parsed = new Date(dateTimeString)
    if (!Number.isNaN(parsed.getTime())) {
      dueDate = parsed
    }
  }

  if (!dueDate && dateString) {
    dueDate = createDateTime(dateString, timeString || '23:59')
  }

  if (!dueDate) return false

  return dueDate.getTime() < now.getTime()
}

// 按优先级排序
function sortByPriority(tasks, ascending = false) {
  return [...tasks].sort((a, b) => {
    const priorityA = PRIORITY_VALUES[a.priority]
    const priorityB = PRIORITY_VALUES[b.priority]
    return ascending ? priorityA - priorityB : priorityB - priorityA
  })
}

// 按日期排序
function sortByDate(tasks, ascending = true) {
  return [...tasks].sort((a, b) => {
    const dateA = getDueDateObject(a)
    const dateB = getDueDateObject(b)

    if (!dateA && !dateB) return 0
    if (!dateA) return 1
    if (!dateB) return -1

    return ascending ? dateA - dateB : dateB - dateA
  })
}

// 按创建时间排序
function sortByCreatedAt(tasks, ascending = false) {
  return [...tasks].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt) : null
    const dateB = b.createdAt ? new Date(b.createdAt) : null

    if (!dateA && !dateB) return 0
    if (!dateA) return 1
    if (!dateB) return -1

    return ascending ? dateA - dateB : dateB - dateA
  })
}

// 过滤已完成/未完成任务
function filterByCompleted(tasks, completed) {
  return tasks.filter(task => task.completed === completed)
}

// 搜索任务
function searchTasks(tasks, keyword) {
  if (!keyword.trim()) return tasks

  const searchTerm = keyword.toLowerCase().trim()
  return tasks.filter(task =>
    (task.title || '').toLowerCase().includes(searchTerm) ||
    (task.description || '').toLowerCase().includes(searchTerm)
  )
}

// 导出所有函数和常量
module.exports = {
  PRIORITY,
  PRIORITY_LABELS,
  PRIORITY_VALUES,
  RECURRENCE_TYPES,
  createTask,
  validateTask,
  formatDate,
  isOverdue,
  sortByPriority,
  sortByDate,
  sortByCreatedAt,
  filterByCompleted,
  searchTasks,
  toISODateTime,
  splitISODateTime,
  createDateTime,
  normalizeWeekdays,
  isValidDateString,
  getDueDateObject,
  clampScore,
  inferImportanceScore,
  inferUrgencyScore,
  getQuadrantFromScores,
  getQuadrantRecommendation,
  DEFAULT_THRESHOLD
}
