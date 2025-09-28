// pages/index/index.js
const {
  PRIORITY_LABELS,
  formatDate,
  isOverdue,
  sortByPriority,
  sortByDate,
  sortByCreatedAt,
  filterByCompleted,
  searchTasks
} = require('../../utils/task.js')

const app = getApp()

Page({
  data: {
    tasks: [],
    filteredTasks: [],
    searchKeyword: '',
    showCompleted: false,
    sortIndex: 0,
    sortOptions: ['按创建时间', '按截止日期', '按优先级'],
    priorityLabels: PRIORITY_LABELS,
    emptyText: '还没有任务，点击右下角添加第一个任务吧！'
  },

  onLoad() {
    this.loadTasks()
  },

  onShow() {
    this.loadTasks()
  },

  loadTasks() {
    const tasks = app.getTasks()
    this.setData({
      tasks
    })
    this.applyFiltersAndSort()
  },

  applyFiltersAndSort() {
    let { tasks, searchKeyword, showCompleted, sortIndex } = this.data

    // 按完成状态筛选
    let filtered = filterByCompleted(tasks, showCompleted)

    // 搜索过滤
    if (searchKeyword.trim()) {
      filtered = searchTasks(filtered, searchKeyword)
    }

    // 排序
    switch (sortIndex) {
      case 0: // 按创建时间
        filtered = sortByCreatedAt(filtered)
        break
      case 1: // 按截止日期
        filtered = sortByDate(filtered)
        break
      case 2: // 按优先级
        filtered = sortByPriority(filtered)
        break
    }

    const emptyText = searchKeyword.trim()
      ? '没有找到匹配的任务'
      : showCompleted
        ? '还没有已完成的任务'
        : '还没有任务，点击右下角添加第一个任务吧！'

    this.setData({
      filteredTasks: filtered,
      emptyText
    })
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

  toggleShowCompleted() {
    this.setData({
      showCompleted: !this.data.showCompleted
    })
    this.applyFiltersAndSort()
  },

  onTaskTap(e) {
    const taskId = e.currentTarget.dataset.id
    // 阻止事件冒泡到checkbox
    if (e.target.dataset.action !== 'checkbox') {
      wx.navigateTo({
        url: `/pages/edit-task/edit-task?id=${taskId}`
      })
    }
  },

  onToggleComplete(e) {
    e.stopPropagation()
    const taskId = e.currentTarget.dataset.id
    const task = this.data.tasks.find(t => t.id === taskId)

    if (task) {
      app.updateTask(taskId, {
        completed: !task.completed,
        updatedAt: new Date().toISOString()
      })
      this.loadTasks()

      // 显示反馈
      wx.showToast({
        title: task.completed ? '任务未完成' : '任务已完成',
        icon: 'success',
        duration: 1500
      })
    }
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
            this.loadTasks()

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

  formatDate(dateString) {
    return formatDate(dateString)
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

  isOverdue(dateString) {
    return isOverdue(dateString)
  },

  onPullDownRefresh() {
    this.loadTasks()
    wx.stopPullDownRefresh()
  }
})