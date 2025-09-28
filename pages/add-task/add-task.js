// pages/add-task/add-task.js
const {
  createTask,
  validateTask,
  PRIORITY,
  PRIORITY_LABELS
} = require('../../utils/task.js')

const app = getApp()

Page({
  data: {
    formData: {
      title: '',
      description: '',
      dueDate: '',
      priority: PRIORITY.MEDIUM
    },
    priorityOptions: [
      { value: PRIORITY.HIGH, label: PRIORITY_LABELS[PRIORITY.HIGH] },
      { value: PRIORITY.MEDIUM, label: PRIORITY_LABELS[PRIORITY.MEDIUM] },
      { value: PRIORITY.LOW, label: PRIORITY_LABELS[PRIORITY.LOW] }
    ],
    errors: [],
    isValid: false,
    today: ''
  },

  onLoad() {
    this.setToday()
  },

  setToday() {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    this.setData({
      today: todayStr
    })
  },

  onTitleInput(e) {
    this.setData({
      'formData.title': e.detail.value
    })
    this.validateForm()
  },

  onDescriptionInput(e) {
    this.setData({
      'formData.description': e.detail.value
    })
    this.validateForm()
  },

  onDateChange(e) {
    this.setData({
      'formData.dueDate': e.detail.value
    })
    this.validateForm()
  },

  clearDate() {
    this.setData({
      'formData.dueDate': ''
    })
    this.validateForm()
  },

  onPrioritySelect(e) {
    const priority = e.currentTarget.dataset.priority
    this.setData({
      'formData.priority': priority
    })
    this.validateForm()
  },

  validateForm() {
    const { formData } = this.data
    const task = createTask(
      formData.title,
      formData.description,
      formData.dueDate,
      formData.priority
    )

    const errors = validateTask(task)
    const isValid = errors.length === 0

    this.setData({
      errors,
      isValid
    })
  },

  onSubmit(e) {
    const { formData } = this.data

    if (!this.data.isValid) {
      wx.showToast({
        title: '请检查输入内容',
        icon: 'error'
      })
      return
    }

    const task = createTask(
      formData.title,
      formData.description,
      formData.dueDate,
      formData.priority
    )

    try {
      app.addTask(task)

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
    const hasContent = formData.title.trim() ||
                      formData.description.trim() ||
                      formData.dueDate

    if (hasContent) {
      wx.showModal({
        title: '确认取消',
        content: '您输入的内容将会丢失，确定要取消吗？',
        success: (res) => {
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
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const tomorrowOnly = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate())

    if (dateOnly.getTime() === todayOnly.getTime()) {
      return '今天'
    } else if (dateOnly.getTime() === tomorrowOnly.getTime()) {
      return '明天'
    } else {
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const day = date.getDate()
      return `${year}年${month}月${day}日`
    }
  }
})