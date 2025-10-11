// pages/edit-task/edit-task.js
const {
  validateTask,
  PRIORITY,
  PRIORITY_LABELS,
  toISODateTime,
  splitISODateTime,
  createDateTime,
  RECURRENCE_TYPES,
  normalizeWeekdays
} = require('../../utils/task.js')

const {
  REMINDER_TEMPLATE_ID,
  REMINDER_TARGET_PAGE,
  isReminderTemplateConfigured,
  requestReminderSubscription,
  buildSubscribeMessageData
} = require('../../utils/reminder.js')

const app = getApp()

Page({
  data: {
    taskId: '',
    originalTask: null,
    formData: {
      title: '',
      description: '',
      dueDate: '',
      dueTime: '',
      priority: PRIORITY.MEDIUM,
      completed: false,
      categoryId: '',
      reminderEnabled: false,
      reminderDate: '',
      reminderTime: '',
      recurrenceEnabled: false,
      recurrenceType: RECURRENCE_TYPES.DAILY,
      recurrenceInterval: 1,
      recurrenceEndDate: '',
      recurrenceWeekdays: []
    },
    dueDateDisplay: '',
    reminderDateDisplay: '',
    recurrenceEndDateDisplay: '',
    categories: [],
    selectedCategoryIndex: 0,
    selectedCategory: null,
    priorityOptions: [
      { value: PRIORITY.HIGH, label: PRIORITY_LABELS[PRIORITY.HIGH] },
      { value: PRIORITY.MEDIUM, label: PRIORITY_LABELS[PRIORITY.MEDIUM] },
      { value: PRIORITY.LOW, label: PRIORITY_LABELS[PRIORITY.LOW] }
    ],
    recurrenceOptions: [
      { value: RECURRENCE_TYPES.DAILY, label: '每天' },
      { value: RECURRENCE_TYPES.WEEKLY, label: '每周' },
      { value: RECURRENCE_TYPES.MONTHLY, label: '每月' },
      { value: RECURRENCE_TYPES.CUSTOM, label: '自定义' }
    ],
    recurrenceTypeIndex: 0,
    recurrenceIntervalUnit: '天',
    showRecurrenceWeekdays: false,
    weekdayOptions: [
      { value: 1, label: '周一' },
      { value: 2, label: '周二' },
      { value: 3, label: '周三' },
      { value: 4, label: '周四' },
      { value: 5, label: '周五' },
      { value: 6, label: '周六' },
      { value: 0, label: '周日' }
    ],
    errors: [],
    isValid: false,
    hasChanges: false,
    today: '',
    reminderTemplateConfigured: isReminderTemplateConfigured(),
    defaultReminderTime: '09:00',
    quadrantRecommendation: '',
    importanceScore: 0,
    urgencyScore: 0
  },

  onLoad(options) {
    const taskId = options.id
    if (!taskId) {
      wx.showToast({
        title: '任务不存在',
        icon: 'error',
        success: () => {
          setTimeout(() => wx.navigateBack(), 1500)
        }
      })
      return
    }

    this.setData({ taskId })
    this.setToday()
    this.syncCategories('', { revalidate: false })
    this.loadTask()
  },

  onShow() {
    this.syncCategories(this.data.formData.categoryId || '', { revalidate: false })
  },

  setToday() {
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`
    this.setData({
      today: todayStr,
      defaultReminderTime: timeStr
    })
  },

  syncCategories(targetCategoryId = '', options = {}) {
    const categories = app.getCategories()

    if (!categories.length) {
      this.setData(
        {
          categories: [],
          selectedCategoryIndex: 0,
          selectedCategory: null,
          'formData.categoryId': ''
        },
        () => {
          if (options.revalidate !== false) {
            this.validateForm()
            this.checkChanges()
          }
        }
      )
      return
    }

    let categoryId = targetCategoryId || this.data.formData.categoryId
    if (!categoryId) {
      categoryId = categories[0].id
    }

    let selectedIndex = categories.findIndex(category => category.id === categoryId)
    if (selectedIndex === -1) {
      selectedIndex = 0
      categoryId = categories[0].id
    }

    const selectedCategory = categories[selectedIndex]

    const updates = {
      categories,
      selectedCategoryIndex: selectedIndex,
      selectedCategory
    }

    if (this.data.formData.categoryId !== categoryId) {
      updates['formData.categoryId'] = categoryId
    }

    this.setData(updates, () => {
      if (options.revalidate !== false) {
        this.validateForm()
        this.checkChanges()
      }
    })
  },

  getRecurrenceTypeIndex(type) {
    const options = this.data.recurrenceOptions || []
    const index = options.findIndex(option => option.value === type)
    return index >= 0 ? index : 0
  },

  getRecurrenceIntervalUnit(type) {
    switch (type) {
      case RECURRENCE_TYPES.MONTHLY:
        return '月'
      case RECURRENCE_TYPES.DAILY:
        return '天'
      default:
        return '周'
    }
  },

  resolveDefaultWeekdays(baseDate) {
    if (!baseDate) {
      const today = new Date()
      return [today.getDay()]
    }

    const parsed = new Date(baseDate)
    if (Number.isNaN(parsed.getTime())) {
      const today = new Date()
      return [today.getDay()]
    }

    return [parsed.getDay()]
  },

  applyRecurrenceType(type, options = {}) {
    const actualType =
      Object.values(RECURRENCE_TYPES).includes(type) && type !== RECURRENCE_TYPES.NONE
        ? type
        : RECURRENCE_TYPES.DAILY
    const showWeekdays =
      actualType === RECURRENCE_TYPES.WEEKLY || actualType === RECURRENCE_TYPES.CUSTOM

    const currentWeekdays =
      options.weekdays !== undefined
        ? options.weekdays
        : this.data.formData.recurrenceWeekdays

    let normalizedWeekdays = showWeekdays
      ? normalizeWeekdays(currentWeekdays)
      : []

    if (showWeekdays && (normalizedWeekdays.length === 0 || options.forceDefaultWeekdays)) {
      normalizedWeekdays = this.resolveDefaultWeekdays(
        this.data.formData.dueDate || this.data.today
      )
    }

    const shouldValidate = options.skipValidate !== true

    this.setData(
      {
        recurrenceTypeIndex: this.getRecurrenceTypeIndex(actualType),
        recurrenceIntervalUnit: this.getRecurrenceIntervalUnit(actualType),
        showRecurrenceWeekdays: showWeekdays,
        'formData.recurrenceType': actualType,
        'formData.recurrenceWeekdays': showWeekdays ? normalizedWeekdays : []
      },
      () => {
        if (shouldValidate) {
          this.validateForm()
          this.checkChanges()
        }
      }
    )
  },

  normalizeTask(task) {
    if (!task) return null

    const dueParts = splitISODateTime(task.dueDateTime || '')
    const reminderParts = splitISODateTime(task.reminderDateTime || '')

    const reminderEnabled =
      typeof task.reminderEnabled === 'boolean'
        ? task.reminderEnabled
        : !!task.reminderDateTime || (!!task.reminderDate && !!task.reminderTime)

    const recurrenceEnabled =
      typeof task.recurrenceEnabled === 'boolean' ? task.recurrenceEnabled : false
    const recurrenceType = recurrenceEnabled
      ? task.recurrenceType && task.recurrenceType !== RECURRENCE_TYPES.NONE
        ? task.recurrenceType
        : RECURRENCE_TYPES.DAILY
      : RECURRENCE_TYPES.NONE
    const recurrenceInterval = recurrenceEnabled
      ? Math.max(1, Number.parseInt(task.recurrenceInterval, 10) || 1)
      : 1
    const recurrenceEndDate = recurrenceEnabled ? task.recurrenceEndDate || '' : ''
    const recurrenceWeekdays = recurrenceEnabled
      ? normalizeWeekdays(task.recurrenceWeekdays || [])
      : []

    return {
      ...task,
      description: task.description || '',
      dueDate: task.dueDate || '',
      dueTime: task.dueTime || dueParts.time || '',
      completedAt:
        task.completed && task.completedAt
          ? (() => {
              const parsed = new Date(task.completedAt)
              return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString()
            })()
          : '',
      reminderEnabled,
      reminderDate: task.reminderDate || reminderParts.date || '',
      reminderTime: task.reminderTime || reminderParts.time || '',
      reminderDateTime:
        task.reminderDateTime ||
        (task.reminderDate && task.reminderTime
          ? toISODateTime(task.reminderDate, task.reminderTime)
          : ''),
      recurrenceEnabled,
      recurrenceType,
      recurrenceInterval,
      recurrenceEndDate,
      recurrenceWeekdays,
      recurrenceOccurrence: recurrenceEnabled
        ? Math.max(1, Number.parseInt(task.recurrenceOccurrence, 10) || 1)
        : 0,
      recurrenceStatus: recurrenceEnabled ? task.recurrenceStatus || 'active' : 'inactive'
    }
  },

  loadTask() {
    const tasks = app.getTasks()
    const task = tasks.find(t => t.id === this.data.taskId)

    if (!task) {
      wx.showToast({
        title: '任务不存在',
        icon: 'error',
        success: () => {
          setTimeout(() => wx.navigateBack(), 1500)
        }
      })
      return
    }

    const normalized = this.normalizeTask(task)

    const recurrenceEnabled = normalized.recurrenceEnabled || false
    const recurrenceTypeForState = recurrenceEnabled
      ? normalized.recurrenceType && normalized.recurrenceType !== RECURRENCE_TYPES.NONE
        ? normalized.recurrenceType
        : RECURRENCE_TYPES.DAILY
      : RECURRENCE_TYPES.DAILY
    const showWeekdays =
      recurrenceEnabled &&
      (recurrenceTypeForState === RECURRENCE_TYPES.WEEKLY ||
        recurrenceTypeForState === RECURRENCE_TYPES.CUSTOM)
    const safeWeekdays = showWeekdays
      ? (normalized.recurrenceWeekdays && normalized.recurrenceWeekdays.length
          ? normalized.recurrenceWeekdays
          : this.resolveDefaultWeekdays(normalized.dueDate || this.data.today))
      : []

    this.setData(
      {
        originalTask: normalized,
        formData: {
          title: normalized.title,
          description: normalized.description || '',
          dueDate: normalized.dueDate,
          dueTime: normalized.dueTime || '',
          priority: normalized.priority,
          completed: normalized.completed || false,
          categoryId: normalized.categoryId || '',
          reminderEnabled: normalized.reminderEnabled,
          reminderDate: normalized.reminderDate,
          reminderTime: normalized.reminderTime,
          recurrenceEnabled,
          recurrenceType: recurrenceTypeForState,
          recurrenceInterval: normalized.recurrenceInterval || 1,
          recurrenceEndDate: recurrenceEnabled ? normalized.recurrenceEndDate || '' : '',
          recurrenceWeekdays: safeWeekdays
        },
        dueDateDisplay: this.formatDisplayDate(normalized.dueDate),
        reminderDateDisplay: this.formatDisplayDate(normalized.reminderDate),
        recurrenceEndDateDisplay: this.formatDisplayDate(normalized.recurrenceEndDate),
        recurrenceTypeIndex: this.getRecurrenceTypeIndex(recurrenceTypeForState),
        recurrenceIntervalUnit: this.getRecurrenceIntervalUnit(recurrenceTypeForState),
        showRecurrenceWeekdays: showWeekdays,
        quadrantRecommendation: normalized.quadrantRecommendation || '',
        importanceScore: Number.isFinite(normalized.importanceScore)
          ? normalized.importanceScore
          : 0,
        urgencyScore: Number.isFinite(normalized.urgencyScore)
          ? normalized.urgencyScore
          : 0
      },
      () => {
        this.syncCategories(normalized.categoryId || '', { revalidate: false })
        this.validateForm()
        this.checkChanges()
      }
    )
  },

  updateForm(fields, callback) {
    const newFormData = { ...this.data.formData }
    let formDataUpdated = false
    let categoryIdUpdated = false
    const dataToSet = {}

    Object.keys(fields).forEach(key => {
      if (key.startsWith('formData.')) {
        const field = key.slice('formData.'.length)
        newFormData[field] = fields[key]
        formDataUpdated = true
        if (field === 'categoryId') {
          categoryIdUpdated = true
        }
      } else {
        dataToSet[key] = fields[key]
      }
    })

    if (formDataUpdated) {
      dataToSet.formData = newFormData
      dataToSet.dueDateDisplay = this.formatDisplayDate(newFormData.dueDate)
      dataToSet.reminderDateDisplay = this.formatDisplayDate(newFormData.reminderDate)
      dataToSet.recurrenceEndDateDisplay = this.formatDisplayDate(
        newFormData.recurrenceEndDate
      )
      if (categoryIdUpdated) {
        const categories = this.data.categories
        let selectedIndex = categories.findIndex(
          category => category.id === newFormData.categoryId
        )
        if (selectedIndex === -1) {
          selectedIndex = categories.length ? 0 : -1
        }
        dataToSet.selectedCategoryIndex = Math.max(selectedIndex, 0)
        dataToSet.selectedCategory =
          selectedIndex >= 0 ? categories[selectedIndex] || null : null
      }
    }

    this.setData(dataToSet, () => {
      this.validateForm()
      this.checkChanges()
      if (typeof callback === 'function') {
        callback()
      }
    })
  },

  toggleCompletion() {
    this.updateForm({
      'formData.completed': !this.data.formData.completed
    })
  },

  onTitleInput(e) {
    this.updateForm({
      'formData.title': e.detail.value
    })
  },

  onDescriptionInput(e) {
    this.updateForm({
      'formData.description': e.detail.value
    })
  },

  onDueDateChange(e) {
    const value = e.detail.value
    const updates = {
      'formData.dueDate': value
    }

    if (this.data.formData.reminderEnabled && !this.data.formData.reminderDate) {
      updates['formData.reminderDate'] = value
    }

    if (
      this.data.formData.recurrenceEnabled &&
      (this.data.formData.recurrenceType === RECURRENCE_TYPES.WEEKLY ||
        this.data.formData.recurrenceType === RECURRENCE_TYPES.CUSTOM) &&
      (!this.data.formData.recurrenceWeekdays ||
        this.data.formData.recurrenceWeekdays.length === 0)
    ) {
      updates['formData.recurrenceWeekdays'] = this.resolveDefaultWeekdays(value)
    }

    this.updateForm(updates)
  },

  onDueTimeChange(e) {
    this.updateForm({
      'formData.dueTime': e.detail.value
    })
  },

  clearDate() {
    const updates = {
      'formData.dueDate': '',
      'formData.dueTime': ''
    }

    if (this.data.formData.reminderEnabled) {
      updates['formData.reminderEnabled'] = false
      updates['formData.reminderDate'] = ''
      updates['formData.reminderTime'] = ''
    }

    if (this.data.formData.recurrenceEnabled) {
      updates['formData.recurrenceEnabled'] = false
      updates['formData.recurrenceEndDate'] = ''
      updates['formData.recurrenceWeekdays'] = []
      updates.showRecurrenceWeekdays = false
    }

    this.updateForm(updates)
  },

  onPrioritySelect(e) {
    const priority = e.currentTarget.dataset.priority
    this.updateForm({
      'formData.priority': priority
    })
  },

  onCategoryChange(e) {
    const index = Number(e.detail.value) || 0
    const category = this.data.categories[index]
    if (!category) return

    this.updateForm({
      'formData.categoryId': category.id,
      selectedCategoryIndex: index,
      selectedCategory: category
    })
  },

  onReminderToggle(e) {
    const enabled = e.detail.value
    const { formData, today, defaultReminderTime } = this.data
    const updates = {
      'formData.reminderEnabled': enabled
    }

    if (enabled) {
      updates['formData.reminderDate'] = formData.reminderDate || formData.dueDate || today
      updates['formData.reminderTime'] =
        formData.reminderTime || formData.dueTime || defaultReminderTime
    } else {
      updates['formData.reminderDate'] = ''
      updates['formData.reminderTime'] = ''
    }

    this.updateForm(updates)
  },

  onReminderDateChange(e) {
    this.updateForm({
      'formData.reminderDate': e.detail.value
    })
  },

  onReminderTimeChange(e) {
    this.updateForm({
      'formData.reminderTime': e.detail.value
    })
  },

  clearReminder() {
    this.updateForm({
      'formData.reminderEnabled': false,
      'formData.reminderDate': '',
      'formData.reminderTime': ''
    })
  },

  onRecurrenceToggle(e) {
    const enabled = e.detail.value

    if (enabled) {
      const updates = {
        'formData.recurrenceEnabled': true
      }

      if (!this.data.formData.recurrenceInterval) {
        updates['formData.recurrenceInterval'] = 1
      }

      if (!this.data.formData.dueDate) {
        updates['formData.dueDate'] = this.data.today
      }

      this.updateForm(updates, () => {
        const type = this.data.formData.recurrenceType || RECURRENCE_TYPES.DAILY
        this.applyRecurrenceType(type, { forceDefaultWeekdays: true })
      })
    } else {
      this.updateForm(
        {
          'formData.recurrenceEnabled': false,
          'formData.recurrenceEndDate': '',
          'formData.recurrenceWeekdays': [],
          showRecurrenceWeekdays: false
        },
        () => {
          this.setData({
            recurrenceTypeIndex: this.getRecurrenceTypeIndex(
              this.data.formData.recurrenceType || RECURRENCE_TYPES.DAILY
            )
          })
        }
      )
    }
  },

  onRecurrenceTypeChange(e) {
    const index = Number(e.detail.value) || 0
    const option = this.data.recurrenceOptions[index]
    const type = option ? option.value : RECURRENCE_TYPES.DAILY
    this.applyRecurrenceType(type, { forceDefaultWeekdays: true })
  },

  onRecurrenceIntervalInput(e) {
    const value = e.detail.value

    if (!value) {
      this.updateForm({ 'formData.recurrenceInterval': '' })
      return
    }

    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed)) {
      this.updateForm({ 'formData.recurrenceInterval': value })
      return
    }

    const interval = Math.max(1, parsed)
    this.updateForm({ 'formData.recurrenceInterval': interval })
  },

  onRecurrenceEndDateChange(e) {
    this.updateForm({
      'formData.recurrenceEndDate': e.detail.value
    })
  },

  clearRecurrenceEndDate() {
    this.updateForm({
      'formData.recurrenceEndDate': ''
    })
  },

  onRecurrenceWeekdayToggle(e) {
    const day = Number(e.currentTarget.dataset.value)
    const current = new Set(this.data.formData.recurrenceWeekdays || [])

    if (current.has(day)) {
      current.delete(day)
    } else {
      current.add(day)
    }

    const next = normalizeWeekdays(Array.from(current))
    this.updateForm({
      'formData.recurrenceWeekdays': next
    })
  },

  validateForm() {
    const errors = validateTask(this.data.formData)
    this.setData({
      errors,
      isValid: errors.length === 0
    })
  },

  checkChanges() {
    const { originalTask, formData } = this.data

    if (!originalTask) {
      this.setData({ hasChanges: false })
      return
    }

    const trimmedTitle = (formData.title || '').trim()
    const trimmedDescription = (formData.description || '').trim()

    const originalRecurrence = {
      enabled: !!originalTask.recurrenceEnabled,
      type: originalTask.recurrenceType || RECURRENCE_TYPES.NONE,
      interval: Number.parseInt(originalTask.recurrenceInterval, 10) || 1,
      endDate: originalTask.recurrenceEndDate || '',
      weekdays: normalizeWeekdays(originalTask.recurrenceWeekdays || [])
    }

    const currentRecurrence = {
      enabled: !!formData.recurrenceEnabled,
      type: formData.recurrenceEnabled
        ? formData.recurrenceType || RECURRENCE_TYPES.DAILY
        : RECURRENCE_TYPES.NONE,
      interval: formData.recurrenceEnabled
        ? Number.parseInt(formData.recurrenceInterval, 10) || 1
        : 1,
      endDate: formData.recurrenceEnabled ? formData.recurrenceEndDate || '' : '',
      weekdays: formData.recurrenceEnabled
        ? normalizeWeekdays(formData.recurrenceWeekdays || [])
        : []
    }

    const recurrenceWeekdaysEqual =
      originalRecurrence.weekdays.length === currentRecurrence.weekdays.length &&
      originalRecurrence.weekdays.every(
        (value, index) => value === currentRecurrence.weekdays[index]
      )

    const recurrenceChanged =
      originalRecurrence.enabled !== currentRecurrence.enabled ||
      originalRecurrence.type !== currentRecurrence.type ||
      originalRecurrence.interval !== currentRecurrence.interval ||
      originalRecurrence.endDate !== currentRecurrence.endDate ||
      !recurrenceWeekdaysEqual

    const hasChanges =
      originalTask.title !== trimmedTitle ||
      (originalTask.description || '') !== trimmedDescription ||
      (originalTask.dueDate || '') !== (formData.dueDate || '') ||
      (originalTask.dueTime || '') !== (formData.dueTime || '') ||
      originalTask.priority !== formData.priority ||
      (originalTask.completed || false) !== formData.completed ||
      (originalTask.categoryId || '') !== (formData.categoryId || '') ||
      (originalTask.reminderEnabled || false) !== formData.reminderEnabled ||
      (originalTask.reminderDate || '') !== (formData.reminderDate || '') ||
      (originalTask.reminderTime || '') !== (formData.reminderTime || '') ||
      recurrenceChanged

    this.setData({ hasChanges })
  },

  async ensureReminderPermission() {
    if (!this.data.formData.reminderEnabled) {
      return false
    }

    if (!this.data.reminderTemplateConfigured) {
      wx.showToast({
        title: '未配置订阅模板，无法开启提醒',
        icon: 'none'
      })
      this.clearReminder()
      return false
    }

    const accepted = await requestReminderSubscription()

    if (!accepted) {
      wx.showToast({
        title: '未授权提醒，已关闭提醒',
        icon: 'none'
      })
      this.clearReminder()
      return false
    }

    return true
  },

  buildUpdatePayload(reminderEnabled) {
    const { formData, originalTask } = this.data
    const trimmedTitle = (formData.title || '').trim()
    const trimmedDescription = (formData.description || '').trim()

    const dueDateTime = formData.dueDate
      ? toISODateTime(formData.dueDate, formData.dueTime || '23:59')
      : ''

    const reminderDateTime =
      reminderEnabled && formData.reminderDate && formData.reminderTime
        ? toISODateTime(formData.reminderDate, formData.reminderTime)
        : ''

    const recurrenceEnabled = !!formData.recurrenceEnabled
    const recurrenceType = recurrenceEnabled
      ? formData.recurrenceType || RECURRENCE_TYPES.DAILY
      : RECURRENCE_TYPES.NONE
    const recurrenceInterval = recurrenceEnabled
      ? Math.max(1, Number.parseInt(formData.recurrenceInterval, 10) || 1)
      : 1
    const recurrenceEndDate = recurrenceEnabled ? formData.recurrenceEndDate || '' : ''
    const recurrenceWeekdays = recurrenceEnabled
      ? normalizeWeekdays(formData.recurrenceWeekdays || [])
      : []
    const recurrenceStatus = recurrenceEnabled ? 'active' : 'inactive'

    const previousCompleted = !!(originalTask && originalTask.completed)
    let completedAt = originalTask && originalTask.completedAt ? originalTask.completedAt : ''
    if (formData.completed && !previousCompleted) {
      completedAt = new Date().toISOString()
    } else if (!formData.completed) {
      completedAt = ''
    }

    return {
      title: trimmedTitle,
      description: trimmedDescription,
      dueDate: formData.dueDate,
      dueTime: formData.dueTime,
      dueDateTime,
      priority: formData.priority,
      categoryId: formData.categoryId,
      completed: formData.completed,
      completedAt,
      reminderEnabled,
      reminderDate: reminderEnabled ? formData.reminderDate : '',
      reminderTime: reminderEnabled ? formData.reminderTime : '',
      reminderDateTime,
      reminderStatus: reminderEnabled ? 'pending' : 'disabled',
      recurrenceEnabled,
      recurrenceType,
      recurrenceInterval,
      recurrenceEndDate,
      recurrenceWeekdays,
      recurrenceStatus,
      updatedAt: new Date().toISOString()
    }
  },

  async syncReminder(task) {
    if (!wx.cloud) return

    const templateConfigured = this.data.reminderTemplateConfigured

    try {
      if (
        templateConfigured &&
        task.reminderEnabled &&
        task.reminderDateTime
      ) {
        const messageData = buildSubscribeMessageData(task)
        await wx.cloud.callFunction({
          name: 'reminder',
          data: {
            action: 'upsert',
            taskId: task.id,
            templateId: REMINDER_TEMPLATE_ID,
            reminderDateTime: task.reminderDateTime,
            dueDateTime: task.dueDateTime,
            title: task.title,
            priority: task.priority,
            page: REMINDER_TARGET_PAGE,
            messageData
          }
        })
      } else {
        await wx.cloud.callFunction({
          name: 'reminder',
          data: {
            action: 'remove',
            taskId: task.id
          }
        })
      }
    } catch (error) {
      console.error('Failed to sync reminder:', error)
    }
  },

  async onSubmit() {
    if (!this.data.isValid) {
      wx.showToast({
        title: '请检查输入内容',
        icon: 'error'
      })
      return
    }

    if (!this.data.hasChanges) {
      wx.showToast({
        title: '没有更改',
        icon: 'none'
      })
      return
    }

    let reminderEnabled = this.data.formData.reminderEnabled
    if (reminderEnabled) {
      reminderEnabled = await this.ensureReminderPermission()
    }

    const updates = this.buildUpdatePayload(reminderEnabled)

    try {
      const updatedTask =
        app.updateTask(this.data.taskId, updates) || {
          ...this.data.originalTask,
          ...updates,
          id: this.data.taskId
        }

      await this.syncReminder(updatedTask)

      this.setData(
        {
          originalTask: updatedTask,
          formData: {
            ...this.data.formData,
            title: updatedTask.title,
            description: updatedTask.description || '',
            dueDate: updatedTask.dueDate || '',
            dueTime: updatedTask.dueTime || '',
            priority: updatedTask.priority,
            completed: updatedTask.completed,
            categoryId: updatedTask.categoryId || '',
            reminderEnabled: updatedTask.reminderEnabled,
            reminderDate: updatedTask.reminderDate || '',
            reminderTime: updatedTask.reminderTime || ''
          },
          dueDateDisplay: this.formatDisplayDate(updatedTask.dueDate),
          reminderDateDisplay: this.formatDisplayDate(updatedTask.reminderDate),
          hasChanges: false,
          quadrantRecommendation: updatedTask.quadrantRecommendation || '',
          importanceScore: Number.isFinite(updatedTask.importanceScore)
            ? updatedTask.importanceScore
            : 0,
          urgencyScore: Number.isFinite(updatedTask.urgencyScore)
            ? updatedTask.urgencyScore
            : 0
        },
        () => {
          this.syncCategories(updatedTask.categoryId || '', { revalidate: false })
          this.validateForm()
          this.checkChanges()
        }
      )

      wx.showToast({
        title: '任务已更新',
        icon: 'success',
        success: () => {
          setTimeout(() => {
            wx.navigateBack()
          }, 1500)
        }
      })
    } catch (error) {
      console.error('Failed to update task:', error)
      wx.showToast({
        title: '更新失败，请重试',
        icon: 'error'
      })
    }
  },

  async removeReminder() {
    if (!wx.cloud) return

    try {
      await wx.cloud.callFunction({
        name: 'reminder',
        data: {
          action: 'remove',
          taskId: this.data.taskId
        }
      })
    } catch (error) {
      console.error('Failed to remove reminder:', error)
    }
  },

  onDelete() {
    const { originalTask } = this.data

    if (!originalTask) return

    wx.showModal({
      title: '确认删除',
      content: `确定要删除任务"${originalTask.title}"吗？此操作无法撤销。`,
      confirmColor: '#FF3B30',
      success: async res => {
        if (res.confirm) {
          try {
            app.deleteTask(this.data.taskId)
            await this.removeReminder()

            wx.showToast({
              title: '任务已删除',
              icon: 'success',
              success: () => {
                setTimeout(() => {
                  wx.navigateBack()
                }, 1500)
              }
            })
          } catch (error) {
            console.error('Failed to delete task:', error)
            wx.showToast({
              title: '删除失败，请重试',
              icon: 'error'
            })
          }
        }
      }
    })
  },

  onCancel() {
    if (this.data.hasChanges) {
      wx.showModal({
        title: '确认取消',
        content: '您的更改将会丢失，确定要取消吗？',
        success: res => {
          if (res.confirm) {
            wx.navigateBack()
          }
        }
      })
    } else {
      wx.navigateBack()
    }
  },

  formatDisplayDate(dateString) {
    if (!dateString) return ''

    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return dateString

    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const todayOnly = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    )
    const tomorrowOnly = new Date(
      tomorrow.getFullYear(),
      tomorrow.getMonth(),
      tomorrow.getDate()
    )

    if (dateOnly.getTime() === todayOnly.getTime()) {
      return '今天'
    }

    if (dateOnly.getTime() === tomorrowOnly.getTime()) {
      return '明天'
    }

    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${year}年${month}月${day}日`
  },

  formatDateTime(dateString) {
    if (!dateString) return ''

    let date = new Date(dateString)

    if (Number.isNaN(date.getTime())) {
      const parts = splitISODateTime(dateString)
      if (!parts.date) {
        return ''
      }

      date = createDateTime(parts.date, parts.time || '00:00')
      if (!date) {
        return ''
      }
    }

    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hours = date.getHours()
    const minutes = date.getMinutes()

    return `${year}年${month}月${day}日 ${String(hours).padStart(2, '0')}:${String(
      minutes
    ).padStart(2, '0')}`
  }
})
