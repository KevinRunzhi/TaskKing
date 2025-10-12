// pages/add-task/add-task.js
const {
  createTask,
  validateTask,
  PRIORITY,
  PRIORITY_LABELS,
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
    formData: {
      title: '',
      description: '',
      dueDate: '',
      dueTime: '',
      priority: PRIORITY.MEDIUM,
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
    categories: [],
    selectedCategoryIndex: 0,
    selectedCategory: null,
    errors: [],
    isValid: false,
    today: '',
    reminderTemplateConfigured: isReminderTemplateConfigured(),
    defaultReminderTime: '09:00',
    dueDateDisplay: '',
    reminderDateDisplay: '',
    recurrenceEndDateDisplay: ''
  },

  onLoad() {
    this.setToday()
    this.syncCategories(false)
  },

  onShow() {
    this.syncCategories(true)
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

  syncCategories(preserveSelection = true) {
    const categories = app.getCategories()
    if (!categories.length) {
      this.setData({
        categories: [],
        selectedCategoryIndex: 0,
        selectedCategory: null,
        'formData.categoryId': ''
      }, () => this.validateForm())
      return
    }

    let categoryId = this.data.formData.categoryId
    if (!preserveSelection || !categoryId) {
      categoryId = categories[0].id
    }

    const selectedIndex = Math.max(
      0,
      categories.findIndex(category => category.id === categoryId)
    )

    const selectedCategory = categories[selectedIndex] || categories[0]

    this.setData(
      {
        categories,
        selectedCategoryIndex: selectedIndex,
        selectedCategory,
        'formData.categoryId': selectedCategory.id
      },
      () => this.validateForm()
    )
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
        }
      }
    )
  },

  validateForm() {
    const { formData } = this.data
    const errors = validateTask(formData)
    this.setData({
      errors,
      isValid: errors.length === 0
    })
  },

  onTitleInput(e) {
    this.setData({
      'formData.title': e.detail.value
    }, () => this.validateForm())
  },

  onDescriptionInput(e) {
    this.setData({
      'formData.description': e.detail.value
    }, () => this.validateForm())
  },

  onDueDateChange(e) {
    const value = e.detail.value
    const updates = {
      'formData.dueDate': value,
      dueDateDisplay: this.formatDisplayDate(value)
    }

    if (this.data.formData.reminderEnabled && !this.data.formData.reminderDate) {
      updates['formData.reminderDate'] = value
      updates.reminderDateDisplay = this.formatDisplayDate(value)
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

    this.setData(updates, () => this.validateForm())
  },

  onDueTimeChange(e) {
    this.setData({
      'formData.dueTime': e.detail.value
    }, () => this.validateForm())
  },

  clearDate() {
    const updates = {
      'formData.dueDate': '',
      'formData.dueTime': '',
      dueDateDisplay: ''
    }

    if (this.data.formData.reminderEnabled) {
      updates['formData.reminderEnabled'] = false
      updates['formData.reminderDate'] = ''
      updates['formData.reminderTime'] = ''
      updates.reminderDateDisplay = ''
    }

    if (this.data.formData.recurrenceEnabled) {
      updates['formData.recurrenceEnabled'] = false
      updates['formData.recurrenceEndDate'] = ''
      updates['formData.recurrenceWeekdays'] = []
      updates.showRecurrenceWeekdays = false
      updates.recurrenceEndDateDisplay = ''
    }

    this.setData(updates, () => this.validateForm())
  },

  onPrioritySelect(e) {
    const priority = e.currentTarget.dataset.priority
    this.setData({
      'formData.priority': priority
    }, () => this.validateForm())
  },

  onCategoryChange(e) {
    const index = Number(e.detail.value) || 0
    const category = this.data.categories[index]
    if (!category) return

    this.setData(
      {
        selectedCategoryIndex: index,
        selectedCategory: category,
        'formData.categoryId': category.id
      },
      () => this.validateForm()
    )
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

    this.setData(updates, () => this.validateForm())
  },

  onReminderDateChange(e) {
    const value = e.detail.value
    this.setData({
      'formData.reminderDate': value,
      reminderDateDisplay: this.formatDisplayDate(value)
    }, () => this.validateForm())
  },

  onReminderTimeChange(e) {
    this.setData({
      'formData.reminderTime': e.detail.value
    }, () => this.validateForm())
  },

  clearReminder() {
    this.setData({
      'formData.reminderEnabled': false,
      'formData.reminderDate': '',
      'formData.reminderTime': ''
    }, () => this.validateForm())
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

      this.setData(updates, () => {
        this.applyRecurrenceType(
          this.data.formData.recurrenceType || RECURRENCE_TYPES.DAILY,
          { forceDefaultWeekdays: true }
        )
      })
    } else {
      this.setData(
        {
          'formData.recurrenceEnabled': false,
          'formData.recurrenceEndDate': '',
          'formData.recurrenceWeekdays': [],
          showRecurrenceWeekdays: false
        },
        () => this.validateForm()
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
      this.setData({ 'formData.recurrenceInterval': '' }, () => this.validateForm())
      return
    }

    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed)) {
      this.setData({ 'formData.recurrenceInterval': value }, () => this.validateForm())
      return
    }

    const interval = Math.max(1, parsed)
    this.setData({ 'formData.recurrenceInterval': interval }, () => this.validateForm())
  },

  onRecurrenceEndDateChange(e) {
    const value = e.detail.value
    this.setData({
      'formData.recurrenceEndDate': value,
      recurrenceEndDateDisplay: this.formatDisplayDate(value)
    }, () => this.validateForm())
  },

  clearRecurrenceEndDate() {
    this.setData({
      'formData.recurrenceEndDate': '',
      recurrenceEndDateDisplay: ''
    }, () => this.validateForm())
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
    this.setData({
      'formData.recurrenceWeekdays': next
    }, () => this.validateForm())
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

  buildTaskPayload(reminderEnabled) {
    const { formData } = this.data

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

    const payload = createTask({
      title: formData.title,
      description: formData.description,
      dueDate: formData.dueDate,
      dueTime: formData.dueTime,
      priority: formData.priority,
      categoryId: formData.categoryId,
      reminderEnabled,
      reminderDate: reminderEnabled ? formData.reminderDate : '',
      reminderTime: reminderEnabled ? formData.reminderTime : '',
      recurrenceEnabled,
      recurrenceType,
      recurrenceInterval,
      recurrenceEndDate,
      recurrenceWeekdays
    })

    if (!reminderEnabled) {
      payload.reminderEnabled = false
      payload.reminderDate = ''
      payload.reminderTime = ''
      payload.reminderDateTime = ''
      payload.reminderStatus = 'disabled'
    }

    if (!recurrenceEnabled) {
      payload.recurrenceEnabled = false
      payload.recurrenceType = RECURRENCE_TYPES.NONE
      payload.recurrenceInterval = 1
      payload.recurrenceEndDate = ''
      payload.recurrenceWeekdays = []
      payload.recurrenceSeriesId = ''
      payload.recurrenceOccurrence = 0
      payload.recurrenceStatus = 'inactive'
    }

    return payload
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

    let reminderEnabled = this.data.formData.reminderEnabled
    if (reminderEnabled) {
      reminderEnabled = await this.ensureReminderPermission()
    }

    const task = this.buildTaskPayload(reminderEnabled)

    try {
      const savedTask = app.addTask(task) || task
      await this.syncReminder(savedTask)

      wx.showToast({
        title: '任务创建成功',
        icon: 'success',
        success: () => {
          setTimeout(() => {
            wx.navigateBack()
          }, 1500)
        }
      })
    } catch (error) {
      console.error('Failed to create task:', error)
      wx.showToast({
        title: '创建失败，请重试',
        icon: 'error'
      })
    }
  },

  onCancel() {
    const { formData } = this.data
    const hasContent =
      formData.title.trim() ||
      formData.description.trim() ||
      formData.dueDate ||
      formData.dueTime ||
      formData.reminderEnabled

    if (hasContent) {
      wx.showModal({
        title: '确认取消',
        content: '您输入的内容将会丢失，确定要取消吗？',
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
  }
})
