// pages/index/index.js
const {
  PRIORITY_LABELS,
  isOverdue,
  sortByPriority,
  sortByDate,
  sortByCreatedAt,
  filterByCompleted,
  searchTasks,
  splitISODateTime
} = require('../../utils/task.js')

const app = getApp()

Page({
  data: {
    tasks: [],
    pendingTasks: [],
    completedTasks: [],
    searchKeyword: '',
    sortIndex: 0,
    sortOptions: ['按创建时间', '按截止日期', '按优先级'],
    priorityLabels: PRIORITY_LABELS,
    categories: [],
    categoryTabs: [],
    selectedCategoryId: 'all'
  },

  onLoad() {
    this.applyFiltersAndSort()
  },

  onShow() {
    this.applyFiltersAndSort()
  },

  applyFiltersAndSort() {
    const { searchKeyword, sortIndex, selectedCategoryId } = this.data
    const categoryState = this.prepareCategoryState(selectedCategoryId)
    const categories = categoryState.categories
    const activeCategoryId = categoryState.selectedCategoryId

    let tasks = app.getTasks()

    if (activeCategoryId !== 'all') {
      tasks = tasks.filter(task => task.categoryId === activeCategoryId)
    }

    // 分离未完成和已完成任务
    let pending = filterByCompleted(tasks, false)
    let completed = filterByCompleted(tasks, true)

    // 搜索过滤
    if (searchKeyword.trim()) {
      pending = searchTasks(pending, searchKeyword)
      completed = searchTasks(completed, searchKeyword)
    }

    // 排序
    const sortFunctions = [sortByCreatedAt, sortByDate, sortByPriority]
    const sortFunc = sortFunctions[sortIndex]

    pending = sortFunc(pending)
    completed = sortFunc(completed)

    const combined = [...pending, ...completed]

    this.setData({
      categories,
      categoryTabs: categoryState.categoryTabs,
      selectedCategoryId: activeCategoryId,
      tasks: this.decorateTasks(combined, categories),
      pendingTasks: this.decorateTasks(pending, categories),
      completedTasks: this.decorateTasks(completed, categories)
    })
  },

  prepareCategoryState(preferredId = 'all') {
    const categories = app.getCategories()

    const categoryTabs = [
      { id: 'all', name: '全部', color: '#64748B', icon: '🌐' },
      ...categories.map(category => ({
        id: category.id,
        name: category.name,
        color: category.color,
        icon: category.icon
      }))
    ]

    let selectedId = preferredId || 'all'
    if (selectedId !== 'all') {
      const exists = categories.some(category => category.id === selectedId)
      if (!exists) {
        selectedId = 'all'
      }
    }

    return {
      categories,
      categoryTabs,
      selectedCategoryId: selectedId
    }
  },

  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    })
    this.applyFiltersAndSort()
  },

  onSortChange(e) {
    this.setData({
      sortIndex: parseInt(e.detail.value)
    })
    this.applyFiltersAndSort()
  },


  onCategorySelect(e) {
    const categoryId = e.currentTarget.dataset.id
    if (!categoryId) {
      return
    }

    if (categoryId === this.data.selectedCategoryId) {
      return
    }

    this.setData(
      {
        selectedCategoryId: categoryId
      },
      () => this.applyFiltersAndSort()
    )
  },

  onManageCategories() {
    wx.navigateTo({
      url: '/pages/categories/categories'
    })
  },


  onTaskTap(e) {
    const taskId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/edit-task/edit-task?id=${taskId}`
    })
  },

  onToggleComplete(e) {
    const taskId = e.currentTarget.dataset.id
    const task = app.getTasks().find(t => t.id === taskId)

    if (!task) return

    const newStatus = !task.completed

    const now = new Date().toISOString()
    const updates = {
      completed: newStatus,
      updatedAt: now,
      completedAt: newStatus ? now : ''
    }

    app.updateTask(taskId, updates)

    this.applyFiltersAndSort()

    wx.showToast({
      title: newStatus ? '任务已完成' : '任务未完成',
      icon: 'success',
      duration: 1000
    })
  },

  onAddTask() {
    wx.navigateTo({
      url: '/pages/add-task/add-task'
    })
  },

  onEditTask(e) {
    e.stopPropagation()
    const taskId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/edit-task/edit-task?id=${taskId}`
    })
  },

  onDeleteTask(e) {
    e.stopPropagation()
    const taskId = e.currentTarget.dataset.id
    const task = this.data.tasks.find(t => t.id === taskId)

    if (task) {
      wx.showModal({
        title: '确认删除',
        content: `确定要删除任务"${task.title}"吗？`,
        success: (res) => {
          if (res.confirm) {
            app.deleteTask(taskId)
            this.removeReminder(taskId)
            this.applyFiltersAndSort()

            wx.showToast({
              title: '任务已删除',
              icon: 'success',
              duration: 1500
            })
          }
        }
      })
    }
  },

  formatCreatedDate(dateString) {
    if (!dateString) return ''

    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return '今天'
    } else if (diffDays === 1) {
      return '昨天'
    } else if (diffDays < 7) {
      return `${diffDays}天前`
    } else {
      return `${date.getMonth() + 1}/${date.getDate()}`
    }
  },

  isOverdueTask(task) {
    if (!task) return false
    return isOverdue(task.dueDate, task.dueTime || '', task.dueDateTime || '')
  },

  decorateTask(task, categories = []) {
    if (!task) return null

    const dueParts = splitISODateTime(task.dueDateTime || '')
    const dueDate = task.dueDate || dueParts.date || ''
    const dueTime = task.dueTime || dueParts.time || ''

    const category = categories.find(c => c.id === task.categoryId) || null
    const categoryColor = category && category.color ? category.color : '#94A3B8'
    const categoryIcon = category && category.icon ? category.icon : '📌'
    const categoryName = category && category.name ? category.name : '未分类'
    const categoryColorLight =
      categoryColor && categoryColor.length === 7
        ? `${categoryColor}1A`
        : '#E2E8F0'

    const recurrenceLabel = this.getRecurrenceLabel(task)

    return {
      ...task,
      displayDueDate: dueDate,
      displayDueTime: dueTime,
      category,
      categoryName,
      categoryIcon,
      categoryColor,
      categoryColorLight,
      recurrenceLabel,
      recurrenceEnabled: !!task.recurrenceEnabled
    }
  },

  decorateTasks(tasks = [], categories = []) {
    return tasks
      .map(task => this.decorateTask(task, categories))
      .filter(Boolean)
  },

  getRecurrenceLabel(task) {
    if (!task || !task.recurrenceEnabled) {
      return ''
    }

    const interval = Math.max(1, Number.parseInt(task.recurrenceInterval, 10) || 1)
    const type = task.recurrenceType || 'daily'
    const weekdays = Array.isArray(task.recurrenceWeekdays)
      ? task.recurrenceWeekdays
      : []
    const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

    switch (type) {
      case 'daily':
        return interval === 1 ? '重复 · 每天' : `重复 · 每${interval}天`
      case 'weekly':
      case 'custom': {
        const base = interval === 1 ? '重复 · 每周' : `重复 · 每${interval}周`
        const names = weekdays
          .map(day => weekdayNames[Number(day)] || '')
          .filter(Boolean)
        return names.length ? `${base} · ${names.join('、')}` : base
      }
      case 'monthly':
        return interval === 1 ? '重复 · 每月' : `重复 · 每${interval}月`
      default:
        return '重复任务'
    }
  },

  onPullDownRefresh() {
    this.applyFiltersAndSort()
    wx.stopPullDownRefresh()
  },

  removeReminder(taskId) {
    if (!wx.cloud) return

    wx.cloud.callFunction({
      name: 'reminder',
      data: {
        action: 'remove',
        taskId
      }
    }).catch(error => {
      console.error('Failed to remove reminder:', error)
    })
  }
})
