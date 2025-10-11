const {
  PRIORITY,
  toISODateTime,
  splitISODateTime,
  createDateTime,
  RECURRENCE_TYPES,
  normalizeWeekdays
} = require('./utils/task.js')

const MAX_GENERATED_OCCURRENCES = 10

const {
  getDefaultCategories,
  createCategory,
  normalizeCategory
} = require('./utils/category.js')

App({
  globalData: {
    tasks: [],
    categories: []
  },

  onLaunch() {
    if (wx.cloud) {
      wx.cloud.init({
        traceUser: true
      })
    }

    this.loadCategories()
    this.loadTasks()
  },

  normalizeTask(task) {
    if (!task) return null

    const normalized = { ...task }

    normalized.title = (normalized.title || '').trim()
    normalized.description = normalized.description || ''
    normalized.priority = normalized.priority || PRIORITY.MEDIUM
    normalized.completed = !!normalized.completed

    if (normalized.completed) {
      const completionSource =
        normalized.completedAt || normalized.updatedAt || normalized.createdAt || ''
      if (completionSource) {
        const parsedCompletion = new Date(completionSource)
        normalized.completedAt = Number.isNaN(parsedCompletion.getTime())
          ? ''
          : parsedCompletion.toISOString()
      } else {
        normalized.completedAt = ''
      }
    } else {
      normalized.completedAt = ''
    }

    const dueParts = splitISODateTime(normalized.dueDateTime || '')

    normalized.dueDate = normalized.dueDate || dueParts.date || ''
    normalized.dueTime =
      normalized.dueTime ||
      (normalized.dueDate ? dueParts.time || '' : '')

    if (normalized.dueDate) {
      normalized.dueDateTime =
        normalized.dueDateTime ||
        toISODateTime(normalized.dueDate, normalized.dueTime || '23:59')
    } else {
      normalized.dueDateTime = ''
      normalized.dueTime = ''
    }

    const reminderParts = splitISODateTime(normalized.reminderDateTime || '')

    normalized.reminderEnabled = !!normalized.reminderEnabled
    normalized.reminderDate = normalized.reminderDate || reminderParts.date || ''
    normalized.reminderTime = normalized.reminderTime || reminderParts.time || ''

    if (normalized.reminderEnabled && normalized.reminderDate && normalized.reminderTime) {
      normalized.reminderDateTime = toISODateTime(
        normalized.reminderDate,
        normalized.reminderTime
      )
      normalized.reminderStatus = normalized.reminderStatus || 'pending'
    } else {
      normalized.reminderEnabled = false
      normalized.reminderDate = ''
      normalized.reminderTime = ''
      normalized.reminderDateTime = ''
      normalized.reminderStatus = 'disabled'
    }

    const categories = this.globalData.categories || []
    const categoryId = (normalized.categoryId || '').toString()
    const categoryExists = categories.some(category => category.id === categoryId)

    normalized.categoryId = categoryExists
      ? categoryId
      : this.getDefaultCategoryId()

    normalized.createdAt = normalized.createdAt || new Date().toISOString()
    normalized.updatedAt = normalized.updatedAt || normalized.createdAt

    normalized.recurrenceEnabled = !!normalized.recurrenceEnabled

    if (normalized.recurrenceEnabled) {
      const validTypes = Object.values(RECURRENCE_TYPES)
      const recurrenceType = validTypes.includes(normalized.recurrenceType)
        ? normalized.recurrenceType
        : RECURRENCE_TYPES.DAILY

      normalized.recurrenceType =
        recurrenceType === RECURRENCE_TYPES.NONE
          ? RECURRENCE_TYPES.DAILY
          : recurrenceType

      normalized.recurrenceInterval = Math.max(
        1,
        Number.parseInt(normalized.recurrenceInterval, 10) || 1
      )

      const normalizedWeekdays = normalizeWeekdays(normalized.recurrenceWeekdays || [])
      if (
        (normalized.recurrenceType === RECURRENCE_TYPES.WEEKLY ||
          normalized.recurrenceType === RECURRENCE_TYPES.CUSTOM) &&
        normalizedWeekdays.length === 0 &&
        normalized.dueDate
      ) {
        const dueDateObj = createDateTime(
          normalized.dueDate,
          normalized.dueTime || '23:59'
        )
        normalized.recurrenceWeekdays = dueDateObj ? [dueDateObj.getDay()] : []
      } else {
        normalized.recurrenceWeekdays = normalizedWeekdays
      }

      normalized.recurrenceEndDate = (normalized.recurrenceEndDate || '').trim()
      normalized.recurrenceSeriesId = (normalized.recurrenceSeriesId || '').toString()
      if (!normalized.recurrenceSeriesId) {
        normalized.recurrenceSeriesId = normalized.id || ''
      }
      normalized.recurrenceOccurrence = Math.max(
        1,
        Number.parseInt(normalized.recurrenceOccurrence, 10) || 1
      )
      normalized.recurrenceStatus = normalized.recurrenceStatus || 'active'
    } else {
      normalized.recurrenceEnabled = false
      normalized.recurrenceType = RECURRENCE_TYPES.NONE
      normalized.recurrenceInterval = 1
      normalized.recurrenceEndDate = ''
      normalized.recurrenceWeekdays = []
      normalized.recurrenceSeriesId = ''
      normalized.recurrenceOccurrence = 0
      normalized.recurrenceStatus = 'inactive'
    }

    return normalized
  },

  loadCategories() {
    try {
      const categories = wx.getStorageSync('categories')
      if (categories && Array.isArray(categories) && categories.length > 0) {
        this.globalData.categories = categories
          .map(category => normalizeCategory(category))
          .filter(Boolean)
      } else {
        this.globalData.categories = getDefaultCategories()
        this.saveCategories()
      }
    } catch (e) {
      console.error('Failed to load categories:', e)
      this.globalData.categories = getDefaultCategories()
      this.saveCategories()
    }

    if (!this.globalData.categories.length) {
      this.globalData.categories = getDefaultCategories()
      this.saveCategories()
    }
  },

  loadTasks() {
    try {
      const tasks = wx.getStorageSync('tasks')
      if (tasks && Array.isArray(tasks)) {
        this.globalData.tasks = tasks
          .map(task => this.normalizeTask(task))
          .filter(Boolean)
        this.ensureRecurringTasks()
        this.saveTasks()
      }
    } catch (e) {
      console.error('Failed to load tasks:', e)
    }
  },

  saveTasks() {
    try {
      wx.setStorageSync('tasks', this.globalData.tasks)
    } catch (e) {
      console.error('Failed to save tasks:', e)
    }
  },

  addTask(task) {
    const now = new Date().toISOString()
    const newTask = {
      ...task,
      id: this.generateTaskId(),
      createdAt: now,
      updatedAt: now
    }

    if (newTask.completed) {
      const completionSource = newTask.completedAt || newTask.updatedAt || newTask.createdAt
      const parsed = completionSource ? new Date(completionSource) : null
      newTask.completedAt = parsed && !Number.isNaN(parsed.getTime())
        ? parsed.toISOString()
        : now
    } else {
      newTask.completedAt = ''
    }

    const normalized = this.normalizeTask(newTask)
    this.globalData.tasks.push(normalized)
    this.ensureRecurringTasks()
    this.saveTasks()
    return this.globalData.tasks.find(t => t.id === normalized.id) || normalized
  },

  updateTask(id, updatedTask) {
    const index = this.globalData.tasks.findIndex(task => task.id === id)
    if (index === -1) {
      return null
    }

    const original = this.globalData.tasks[index]

    const merged = {
      ...original,
      ...updatedTask
    }

    if (Object.prototype.hasOwnProperty.call(updatedTask, 'completed')) {
      const previousCompleted = !!original.completed
      const nextCompleted = !!merged.completed

      if (nextCompleted && !previousCompleted) {
        const completionSource =
          updatedTask.completedAt || merged.completedAt || merged.updatedAt || merged.createdAt
        const parsed = completionSource ? new Date(completionSource) : null
        merged.completedAt = parsed && !Number.isNaN(parsed.getTime())
          ? parsed.toISOString()
          : new Date().toISOString()
      } else if (!nextCompleted && previousCompleted) {
        merged.completedAt = ''
      } else if (
        nextCompleted &&
        Object.prototype.hasOwnProperty.call(updatedTask, 'completedAt')
      ) {
        const provided = updatedTask.completedAt
        const parsed = provided ? new Date(provided) : null
        merged.completedAt = parsed && !Number.isNaN(parsed.getTime())
          ? parsed.toISOString()
          : merged.completedAt
      }
    }

    const normalized = this.normalizeTask(merged)
    this.globalData.tasks[index] = normalized
    this.ensureRecurringTasks()
    this.saveTasks()
    return this.globalData.tasks[index]
  },

  deleteTask(id) {
    this.globalData.tasks = this.globalData.tasks.filter(task => task.id !== id)
    this.ensureRecurringTasks()
    this.saveTasks()
  },

  getTasks() {
    if (this.ensureRecurringTasks()) {
      this.saveTasks()
    }
    return this.globalData.tasks
  },

  generateTaskId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
  },

  getTaskDueInfo(task) {
    const empty = { date: '', time: '', dateTime: '', dateObj: null }
    if (!task) {
      return empty
    }

    if (task.dueDateTime) {
      const parsed = new Date(task.dueDateTime)
      if (!Number.isNaN(parsed.getTime())) {
        return this.formatDateInfo(parsed)
      }
    }

    if (task.dueDate) {
      const parsed = createDateTime(task.dueDate, task.dueTime || '23:59')
      if (parsed) {
        return this.formatDateInfo(parsed)
      }
    }

    return empty
  },

  formatDateInfo(dateObj) {
    if (!dateObj || Number.isNaN(dateObj.getTime())) {
      return { date: '', time: '', dateTime: '', dateObj: null }
    }

    const year = dateObj.getFullYear()
    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
    const day = String(dateObj.getDate()).padStart(2, '0')
    const hour = String(dateObj.getHours()).padStart(2, '0')
    const minute = String(dateObj.getMinutes()).padStart(2, '0')

    const date = `${year}-${month}-${day}`
    const time = `${hour}:${minute}`

    return {
      date,
      time,
      dateTime: toISODateTime(date, time),
      dateObj
    }
  },

  compareTaskDueDate(a, b) {
    const infoA = this.getTaskDueInfo(a)
    const infoB = this.getTaskDueInfo(b)

    if (!infoA.dateObj && !infoB.dateObj) return 0
    if (!infoA.dateObj) return -1
    if (!infoB.dateObj) return 1

    return infoA.dateObj.getTime() - infoB.dateObj.getTime()
  },

  getReminderConfig(task) {
    if (!task || !task.reminderEnabled || !task.reminderDateTime) {
      return { enabled: false, offset: 0 }
    }

    const dueInfo = this.getTaskDueInfo(task)
    const dueDate = dueInfo.dateObj
    const reminderDate = new Date(task.reminderDateTime)

    if (!dueDate || Number.isNaN(reminderDate.getTime())) {
      return { enabled: false, offset: 0 }
    }

    const offset = dueDate.getTime() - reminderDate.getTime()

    return {
      enabled: offset >= 0,
      offset: offset >= 0 ? offset : 0
    }
  },

  getSeriesConfig(task) {
    if (!task || !task.recurrenceEnabled) {
      return null
    }

    const validTypes = Object.values(RECURRENCE_TYPES)
    const type = validTypes.includes(task.recurrenceType)
      ? task.recurrenceType
      : RECURRENCE_TYPES.DAILY

    const interval = Math.max(1, Number.parseInt(task.recurrenceInterval, 10) || 1)
    const weekdays = normalizeWeekdays(task.recurrenceWeekdays || [])
    const endDate = task.recurrenceEndDate
      ? createDateTime(task.recurrenceEndDate, '23:59')
      : null
    const reminder = this.getReminderConfig(task)

    return {
      type: type === RECURRENCE_TYPES.NONE ? RECURRENCE_TYPES.DAILY : type,
      interval,
      weekdays,
      endDate,
      reminder
    }
  },

  computeNextOccurrenceDate(referenceDate, config) {
    if (!referenceDate || !config) {
      return null
    }

    const interval = config.interval || 1

    switch (config.type) {
      case RECURRENCE_TYPES.DAILY: {
        const next = new Date(referenceDate.getTime())
        next.setDate(next.getDate() + interval)
        return next
      }
      case RECURRENCE_TYPES.WEEKLY:
      case RECURRENCE_TYPES.CUSTOM: {
        const weekdays = (config.weekdays && config.weekdays.length)
          ? [...config.weekdays]
          : [referenceDate.getDay()]
        weekdays.sort((a, b) => a - b)
        const currentDay = referenceDate.getDay()
        const nextDay = weekdays.find(day => day > currentDay)
        const next = new Date(referenceDate.getTime())

        if (nextDay !== undefined) {
          next.setDate(next.getDate() + (nextDay - currentDay))
          return next
        }

        const firstDay = weekdays[0]
        const delta = interval * 7 - (currentDay - firstDay)
        next.setDate(next.getDate() + delta)
        return next
      }
      case RECURRENCE_TYPES.MONTHLY: {
        const targetDay = referenceDate.getDate()
        const hours = referenceDate.getHours()
        const minutes = referenceDate.getMinutes()
        const totalMonths = referenceDate.getMonth() + interval
        const year = referenceDate.getFullYear() + Math.floor(totalMonths / 12)
        const monthIndex = ((totalMonths % 12) + 12) % 12
        const candidate = new Date(
          year,
          monthIndex,
          targetDay,
          hours,
          minutes,
          0,
          0
        )

        if (candidate.getMonth() !== monthIndex) {
          return new Date(year, monthIndex + 1, 0, hours, minutes, 0, 0)
        }

        return candidate
      }
      default:
        return null
    }
  },

  isSameOccurrence(task, target) {
    const info = this.getTaskDueInfo(task)
    return info.date === target.date && info.time === target.time
  },

  buildRecurringTask(templateTask, seriesId, nextInfo, occurrence, config) {
    const nowISO = new Date().toISOString()
    let reminderEnabled = !!(config.reminder && config.reminder.enabled)
    let reminderDate = ''
    let reminderTime = ''
    let reminderDateTime = ''

    if (reminderEnabled && config.reminder.offset >= 0 && nextInfo.dateObj) {
      const reminderDateObj = new Date(nextInfo.dateObj.getTime() - config.reminder.offset)
      if (!Number.isNaN(reminderDateObj.getTime())) {
        reminderDateTime = reminderDateObj.toISOString()
        const reminderParts = splitISODateTime(reminderDateTime)
        reminderDate = reminderParts.date
        reminderTime = reminderParts.time
      } else {
        reminderEnabled = false
      }
    } else if (!nextInfo.dateObj) {
      reminderEnabled = false
    }

    const newTask = {
      id: this.generateTaskId(),
      title: templateTask.title,
      description: templateTask.description || '',
      dueDate: nextInfo.date,
      dueTime: nextInfo.time,
      dueDateTime: nextInfo.dateTime,
      priority: templateTask.priority,
      categoryId: templateTask.categoryId,
      completed: false,
      completedAt: '',
      createdAt: nowISO,
      updatedAt: nowISO,
      reminderEnabled,
      reminderDate: reminderEnabled ? reminderDate : '',
      reminderTime: reminderEnabled ? reminderTime : '',
      reminderDateTime: reminderEnabled ? reminderDateTime : '',
      reminderStatus: reminderEnabled ? 'pending' : 'disabled',
      recurrenceEnabled: true,
      recurrenceType: templateTask.recurrenceType,
      recurrenceInterval: templateTask.recurrenceInterval,
      recurrenceEndDate: templateTask.recurrenceEndDate || '',
      recurrenceWeekdays: [...(templateTask.recurrenceWeekdays || [])],
      recurrenceSeriesId: seriesId,
      recurrenceOccurrence: occurrence,
      recurrenceStatus: 'active'
    }

    return this.normalizeTask(newTask)
  },

  ensureRecurringTasks() {
    const tasks = this.globalData.tasks
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return false
    }

    const now = new Date()
    let changed = false
    const seriesMap = new Map()

    tasks.forEach(task => {
      if (task.recurrenceEnabled) {
        if (!task.recurrenceSeriesId) {
          task.recurrenceSeriesId = task.id || this.generateTaskId()
          changed = true
        }
        const seriesId = task.recurrenceSeriesId
        if (!seriesMap.has(seriesId)) {
          seriesMap.set(seriesId, [])
        }
        seriesMap.get(seriesId).push(task)
      } else if (task.recurrenceStatus !== 'inactive') {
        task.recurrenceStatus = 'inactive'
        task.recurrenceSeriesId = ''
        task.recurrenceOccurrence = 0
        changed = true
      }
    })

    seriesMap.forEach((list, seriesId) => {
      if (!list.length) {
        return
      }

      list.sort((a, b) => this.compareTaskDueDate(a, b))

      let seriesChanged = false

      list.forEach((task, index) => {
        const expected = index + 1
        if (task.recurrenceOccurrence !== expected) {
          task.recurrenceOccurrence = expected
          seriesChanged = true
        }
        if (task.recurrenceSeriesId !== seriesId) {
          task.recurrenceSeriesId = seriesId
          seriesChanged = true
        }
        if (task.recurrenceStatus !== 'active') {
          task.recurrenceStatus = 'active'
          seriesChanged = true
        }
      })

      let pointer = list[list.length - 1]
      const config = this.getSeriesConfig(pointer)
      if (!config) {
        return
      }

      let generated = 0

      while (pointer) {
        const dueInfo = this.getTaskDueInfo(pointer)
        if (!dueInfo.dateObj) {
          break
        }

        const shouldGenerate =
          pointer.completed || dueInfo.dateObj.getTime() < now.getTime()

        if (!shouldGenerate) {
          break
        }

        const nextDate = this.computeNextOccurrenceDate(dueInfo.dateObj, config)
        if (!nextDate) {
          break
        }

        if (config.endDate && nextDate.getTime() > config.endDate.getTime()) {
          break
        }

        const nextInfo = this.formatDateInfo(nextDate)
        if (list.some(existing => this.isSameOccurrence(existing, nextInfo))) {
          break
        }

        const occurrence = list.length + 1
        const newTask = this.buildRecurringTask(pointer, seriesId, nextInfo, occurrence, config)
        this.globalData.tasks.push(newTask)
        list.push(newTask)
        pointer = newTask
        seriesChanged = true
        generated += 1

        if (generated >= MAX_GENERATED_OCCURRENCES) {
          break
        }
      }

      if (seriesChanged) {
        list.sort((a, b) => this.compareTaskDueDate(a, b))
        list.forEach((task, index) => {
          const expected = index + 1
          if (task.recurrenceOccurrence !== expected) {
            task.recurrenceOccurrence = expected
          }
        })
        changed = true
      }
    })

    return changed
  },

  saveCategories() {
    try {
      wx.setStorageSync('categories', this.globalData.categories)
    } catch (e) {
      console.error('Failed to save categories:', e)
    }
  },

  getCategories() {
    if (!this.globalData.categories.length) {
      this.loadCategories()
    }
    return this.globalData.categories
  },

  getDefaultCategoryId() {
    if (!this.globalData.categories.length) {
      this.loadCategories()
    }
    return this.globalData.categories[0]?.id || ''
  },

  addCategory(categoryData) {
    const category = createCategory(categoryData)
    this.globalData.categories.push(category)
    this.saveCategories()
    return category
  },

  updateCategory(id, updates) {
    const index = this.globalData.categories.findIndex(category => category.id === id)
    if (index === -1) {
      return null
    }

    const updated = normalizeCategory({
      ...this.globalData.categories[index],
      ...updates,
      id
    })

    this.globalData.categories[index] = updated
    this.saveCategories()
    return updated
  },

  deleteCategory(id) {
    if (this.globalData.categories.length <= 1) {
      return false
    }

    const index = this.globalData.categories.findIndex(category => category.id === id)
    if (index === -1) {
      return false
    }

    this.globalData.categories.splice(index, 1)
    this.saveCategories()

    const fallbackId = this.getDefaultCategoryId()

    let updated = false
    this.globalData.tasks = this.globalData.tasks.map(task => {
      if (task.categoryId === id) {
        updated = true
        return this.normalizeTask({ ...task, categoryId: fallbackId })
      }
      return task
    })

    if (updated) {
      this.saveTasks()
    }

    return true
  }
})
