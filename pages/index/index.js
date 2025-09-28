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
    pendingTasks: [],
    completedTasks: [],
    searchKeyword: '',
    sortIndex: 0,
    sortOptions: ['按创建时间', '按截止日期', '按优先级'],
    priorityLabels: PRIORITY_LABELS
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
    let { tasks, searchKeyword, sortIndex } = this.data

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

    this.setData({
      tasks: tasks, // 确保tasks数据也更新到视图
      pendingTasks: pending,
      completedTasks: completed
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


  onTaskTap(e) {
    const taskId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/edit-task/edit-task?id=${taskId}`
    })
  },

  onToggleComplete(e) {
    const taskId = e.currentTarget.dataset.id
    const task = this.data.tasks.find(t => t.id === taskId)

    if (!task) return

    const newStatus = !task.completed
    console.log('Toggle task:', taskId, 'to', newStatus)

    // 1. 立即更新本地任务数组
    const updatedTasks = this.data.tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          completed: newStatus,
          updatedAt: new Date().toISOString()
        }
      }
      return t
    })

    // 2. 立即更新全局数据并保存
    app.updateTask(taskId, {
      completed: newStatus,
      updatedAt: new Date().toISOString()
    })

    // 3. 立即更新页面数据
    this.setData({
      tasks: updatedTasks
    })

    // 4. 立即重新分类显示
    this.applyFiltersAndSort()

    // 5. 显示反馈
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