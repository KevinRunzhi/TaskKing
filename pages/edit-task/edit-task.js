// pages/edit-task/edit-task.js
const {
  validateTask,
  PRIORITY,
  PRIORITY_LABELS
} = require('../../utils/task.js')

const app = getApp()

Page({
  data: {
    taskId: '',
    originalTask: null,
    formData: {
      title: '',
      description: '',
      dueDate: '',
      priority: PRIORITY.MEDIUM,
      completed: false
    },
    priorityOptions: [
      { value: PRIORITY.HIGH, label: PRIORITY_LABELS[PRIORITY.HIGH] },
      { value: PRIORITY.MEDIUM, label: PRIORITY_LABELS[PRIORITY.MEDIUM] },
      { value: PRIORITY.LOW, label: PRIORITY_LABELS[PRIORITY.LOW] }
    ],
    errors: [],
    isValid: false,
    hasChanges: false,
    today: ''
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
    this.loadTask()
  },

  setToday() {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    this.setData({ today: todayStr })
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

    this.setData({
      originalTask: task,
      formData: {
        title: task.title,
        description: task.description || '',
        dueDate: task.dueDate || '',
        priority: task.priority,
        completed: task.completed || false
      }
    })

    this.validateForm()
  },

  toggleCompletion() {
    this.setData({
      'formData.completed': !this.data.formData.completed
    })
    this.checkChanges()
  },

  onTitleInput(e) {
    this.setData({
      'formData.title': e.detail.value
    })
    this.validateForm()
    this.checkChanges()
  },

  onDescriptionInput(e) {
    this.setData({
      'formData.description': e.detail.value
    })
    this.validateForm()
    this.checkChanges()
  },

  onDateChange(e) {
    this.setData({
      'formData.dueDate': e.detail.value
    })
    this.validateForm()
    this.checkChanges()
  },

  clearDate() {
    this.setData({
      'formData.dueDate': ''
    })
    this.validateForm()
    this.checkChanges()
  },

  onPrioritySelect(e) {
    const priority = e.currentTarget.dataset.priority
    this.setData({
      'formData.priority': priority
    })
    this.validateForm()
    this.checkChanges()
  },

  validateForm() {
    const { formData } = this.data
    const errors = validateTask(formData)
    const isValid = errors.length === 0

    this.setData({
      errors,
      isValid
    })
  },

  checkChanges() {
    const { originalTask, formData } = this.data

    if (!originalTask) {
      this.setData({ hasChanges: false })
      return
    }

    const hasChanges = (
      originalTask.title !== formData.title ||
      (originalTask.description || '') !== formData.description ||
      (originalTask.dueDate || '') !== formData.dueDate ||
      originalTask.priority !== formData.priority ||
      (originalTask.completed || false) !== formData.completed
    )

    this.setData({ hasChanges })
  },

  onSubmit(e) {
    const { formData, taskId, hasChanges } = this.data

    if (!this.data.isValid) {
      wx.showToast({
        title: '请检查输入内容',
        icon: 'error'
      })
      return
    }

    if (!hasChanges) {
      wx.showToast({
        title: '没有更改',
        icon: 'none'
      })
      return
    }

    try {
      const updatedFields = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        dueDate: formData.dueDate,
        priority: formData.priority,
        completed: formData.completed,
        updatedAt: new Date().toISOString()
      }

      app.updateTask(taskId, updatedFields)

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

  onDelete() {
    const { originalTask } = this.data

    if (!originalTask) return

    wx.showModal({
      title: '确认删除',
      content: `确定要删除任务"${originalTask.title}"吗？此操作无法撤销。`,
      confirmColor: '#FF3B30',
      success: (res) => {
        if (res.confirm) {
          try {
            app.deleteTask(this.data.taskId)

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
    const { hasChanges } = this.data

    if (hasChanges) {
      wx.showModal({
        title: '确认取消',
        content: '您的更改将会丢失，确定要取消吗？',
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
  },

  formatDateTime(dateString) {
    if (!dateString) return ''

    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hours = date.getHours()
    const minutes = date.getMinutes()

    return `${year}年${month}月${day}日 ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }
})