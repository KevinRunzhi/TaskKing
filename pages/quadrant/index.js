const app = getApp()

const {
  clampScore,
  getQuadrantFromScores,
  getQuadrantRecommendation,
  DEFAULT_THRESHOLD
} = require('../../utils/task.js')

const QUADRANT_TITLES = {
  1: '立即处理',
  2: '计划安排',
  3: '尽量委托',
  4: '可以舍弃'
}

function formatDateLabel(dateString = '', timeString = '') {
  if (!dateString) {
    return ''
  }
  const parts = dateString.split('-')
  if (parts.length !== 3) {
    return dateString
  }
  const [, monthRaw, dayRaw] = parts
  const month = Number.parseInt(monthRaw, 10)
  const day = Number.parseInt(dayRaw, 10)
  const monthLabel = Number.isNaN(month) ? monthRaw : `${month}月`
  const dayLabel = Number.isNaN(day) ? dayRaw : `${day}日`
  return `${monthLabel}${dayLabel}${timeString ? ` ${timeString}` : ''}`.trim()
}

Page({
  data: {
    searchKeyword: '',
    categoryOptions: [],
    selectedCategoryIndex: 0,
    tagOptions: [],
    selectedTags: [],
    batchMode: false,
    selectedTaskIds: [],
    activeTasks: [],
    completedTasks: [],
    quadrantStats: {
      q1: 0,
      q2: 0,
      q3: 0,
      q4: 0
    },
    quadrantBuckets: {
      q1: [],
      q2: [],
      q3: [],
      q4: []
    },
    areaSize: {
      width: 0,
      height: 0
    },
    maxPosition: {
      x: 0,
      y: 0
    },
    threshold: DEFAULT_THRESHOLD,
    viewMode: 'stacked',
    stackedConfig: [
      { key: 'q1', title: QUADRANT_TITLES[1] },
      { key: 'q2', title: QUADRANT_TITLES[2] },
      { key: 'q3', title: QUADRANT_TITLES[3] },
      { key: 'q4', title: QUADRANT_TITLES[4] }
    ],
    loading: true
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    this.rpxUnit = systemInfo.windowWidth / 750
    this.cardSize = {
      width: Math.round(220 * this.rpxUnit),
      height: Math.round(180 * this.rpxUnit)
    }
    this.dragCache = {}
    this.hasMeasured = false
    this.lastDragId = ''
    this.lastDragTime = 0
  },

  onReady() {
    this.measureArea(() => {
      this.hasMeasured = true
      this.refreshData()
    })
  },

  onShow() {
    if (this.hasMeasured) {
      this.refreshData()
    }
  },

  measureArea(callback) {
    wx.createSelectorQuery()
      .in(this)
      .select('#quadrantArea')
      .boundingClientRect(rect => {
        if (!rect) {
          if (typeof callback === 'function') {
            callback()
          }
          return
        }
        const maxX = Math.max(0, rect.width - this.cardSize.width)
        const maxY = Math.max(0, rect.height - this.cardSize.height)
        this.setData(
          {
            areaSize: {
              width: rect.width,
              height: rect.height
            },
            maxPosition: {
              x: maxX,
              y: maxY
            }
          },
          () => {
            if (typeof callback === 'function') {
              callback()
            }
          }
        )
      })
      .exec()
  },

  refreshData() {
    const tasks = app.getTasks()
    const categories = app.getCategories()

    const categoryOptions = this.buildCategoryOptions(categories)
    const selectedCategoryIndex = Math.min(
      this.data.selectedCategoryIndex,
      Math.max(categoryOptions.length - 1, 0)
    )
    const selectedCategoryId =
      categoryOptions[selectedCategoryIndex]?.id || 'all'

    const keyword = (this.data.searchKeyword || '').trim().toLowerCase()
    const selectedTags = Array.isArray(this.data.selectedTags)
      ? this.data.selectedTags
      : []

    const availableTags = new Set()
    const activeTasks = []
    const completedTasks = []
    const categoryMap = this.buildCategoryMap(categories)

    tasks.forEach(task => {
      if (!task) {
        return
      }
      const taskTags = Array.isArray(task.tags)
        ? task.tags
            .map(tag =>
              typeof tag === 'string' ? tag.trim() : String(tag || '').trim()
            )
            .filter(Boolean)
        : []

      taskTags.forEach(tag => availableTags.add(tag))

      const matchesCategory =
        selectedCategoryId === 'all' || task.categoryId === selectedCategoryId
      const titleLower = (task.title || '').toLowerCase()
      const descriptionLower = (task.description || '').toLowerCase()
      const matchesKeyword =
        !keyword ||
        titleLower.includes(keyword) ||
        descriptionLower.includes(keyword)
      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.every(tag => taskTags.includes(tag))

      if (!(matchesCategory && matchesKeyword && matchesTags)) {
        return
      }

      if (task.completed) {
        completedTasks.push(this.decorateCompletedTask(task, categoryMap))
      } else {
        activeTasks.push(this.decorateActiveTask(task, taskTags))
      }
    })

    const prunedSelection = this.pruneSelection(
      activeTasks.map(item => item.id)
    )
    const positionedActive = this.calculatePositions(activeTasks).map(item => ({
      ...item,
      selected: prunedSelection.includes(item.id)
    }))

    const quadrantStats = this.buildQuadrantStats(positionedActive)
    const quadrantBuckets = this.buildQuadrantBuckets(positionedActive)

    this.setData({
      categoryOptions,
      selectedCategoryIndex,
      tagOptions: Array.from(availableTags),
      activeTasks: positionedActive,
      completedTasks,
      selectedTaskIds: prunedSelection,
      quadrantStats,
      quadrantBuckets,
      loading: false
    })
  },

  buildCategoryOptions(categories = []) {
    const options = [{ id: 'all', name: '全部分类' }]
    categories.forEach(category => {
      if (category && category.id) {
        options.push({
          id: category.id,
          name: category.name || '未命名'
        })
      }
    })
    return options
  },

  buildCategoryMap(categories = []) {
    return (categories || []).reduce((map, category) => {
      if (category && category.id) {
        map[category.id] = {
          name: category.name || '未命名',
          color: category.color || '#6366F1',
          icon: category.icon || '📌'
        }
      }
      return map
    }, {})
  },

  decorateActiveTask(task, tags) {
    const importance = clampScore(task.importanceScore)
    const urgency = clampScore(task.urgencyScore)
    const quadrant = getQuadrantFromScores(
      importance,
      urgency,
      this.data.threshold
    )

    const dueInfo = app.getTaskDueInfo(task)
    const dueLabel = formatDateLabel(dueInfo.date, dueInfo.time)
    const dueDateObj = dueInfo.dateObj

    return {
      id: task.id,
      title: task.title || '未命名任务',
      importance,
      urgency,
      quadrant,
      recommendation: task.quadrantRecommendation || QUADRANT_TITLES[quadrant],
      tags,
      dueText: dueLabel,
      isOverdue: dueDateObj ? dueDateObj.getTime() < Date.now() : false,
      position: { x: 0, y: 0 },
      selected: false
    }
  },

  decorateCompletedTask(task, categoryMap) {
    const category = categoryMap[task.categoryId] || {
      name: '未分类',
      icon: '🗂️'
    }

    const completedAt = task.completedAt ? new Date(task.completedAt) : null
    let completedLabel = ''
    if (completedAt && !Number.isNaN(completedAt.getTime())) {
      const month = completedAt.getMonth() + 1
      const day = completedAt.getDate()
      const hour = completedAt.getHours().toString().padStart(2, '0')
      const minute = completedAt.getMinutes().toString().padStart(2, '0')
      completedLabel = `${month}月${day}日 ${hour}:${minute}`
    }

    return {
      id: task.id,
      title: task.title || '未命名任务',
      categoryName: category.name,
      categoryIcon: category.icon,
      recommendation: task.quadrantRecommendation || '',
      completedAtLabel: completedLabel
    }
  },

  calculatePositions(tasks) {
    const { maxPosition } = this.data
    return tasks.map(task => ({
      ...task,
      position: {
        x: this.projectImportance(task.importance, maxPosition.x),
        y: this.projectUrgency(task.urgency, maxPosition.y)
      }
    }))
  },

  projectImportance(score, maxValue) {
    if (maxValue <= 0) {
      return 0
    }
    const ratio = clampScore(score) / 100
    return Math.round(ratio * maxValue)
  },

  projectUrgency(score, maxValue) {
    if (maxValue <= 0) {
      return 0
    }
    const ratio = (100 - clampScore(score)) / 100
    return Math.round(ratio * maxValue)
  },

  buildQuadrantStats(tasks = []) {
    return tasks.reduce(
      (acc, task) => {
        switch (task.quadrant) {
          case 1:
            acc.q1 += 1
            break
          case 2:
            acc.q2 += 1
            break
          case 3:
            acc.q3 += 1
            break
          default:
            acc.q4 += 1
            break
        }
        return acc
      },
      { q1: 0, q2: 0, q3: 0, q4: 0 }
    )
  },

  buildQuadrantBuckets(tasks = []) {
    const buckets = {
      q1: [],
      q2: [],
      q3: [],
      q4: []
    }
    tasks.forEach(task => {
      const key = `q${task.quadrant}`
      if (buckets[key]) {
        buckets[key].push(task)
      }
    })
    return buckets
  },

  pruneSelection(validIds = []) {
    if (!Array.isArray(this.data.selectedTaskIds)) {
      return []
    }
    const validSet = new Set(validIds)
    return this.data.selectedTaskIds.filter(id => validSet.has(id))
  },

  onSearchInput(event) {
    this.setData(
      {
        searchKeyword: event.detail.value || ''
      },
      () => this.refreshData()
    )
  },

  onClearSearch() {
    this.setData(
      {
        searchKeyword: ''
      },
      () => this.refreshData()
    )
  },

  onCategoryChange(event) {
    const index = Number.parseInt(event.detail.value, 10) || 0
    this.setData(
      {
        selectedCategoryIndex: index
      },
      () => this.refreshData()
    )
  },

  onTagTap(event) {
    const { tag } = event.currentTarget.dataset
    if (!tag) {
      return
    }
    const selected = new Set(this.data.selectedTags || [])
    if (selected.has(tag)) {
      selected.delete(tag)
    } else {
      selected.add(tag)
    }
    this.setData(
      {
        selectedTags: Array.from(selected)
      },
      () => this.refreshData()
    )
  },

  toggleBatchMode() {
    const nextMode = !this.data.batchMode
    const applyMode = () => {
      const resetTasks = this.data.activeTasks.map(task => ({
        ...task,
        selected: false
      }))
      this.setData({
        batchMode: nextMode,
        selectedTaskIds: [],
        activeTasks: resetTasks,
        quadrantBuckets: this.buildQuadrantBuckets(resetTasks)
      })
    }

    if (nextMode && this.data.viewMode !== 'expanded') {
      this.switchToExpanded(() => applyMode())
      return
    }

    applyMode()
  },

  switchToExpanded(callback) {
    if (this.data.viewMode === 'expanded') {
      if (typeof callback === 'function') {
        callback()
      }
      return
    }
    this.setData(
      {
        viewMode: 'expanded'
      },
      () => {
        this.measureArea(() => {
          if (typeof callback === 'function') {
            callback()
          }
        })
      }
    )
  },

  switchToStacked() {
    if (this.data.viewMode === 'stacked') {
      return
    }
    const resetTasks = this.data.activeTasks.map(task => ({
      ...task,
      selected: false
    }))
    this.setData({
      viewMode: 'stacked',
      batchMode: false,
      selectedTaskIds: [],
      activeTasks: resetTasks,
      quadrantBuckets: this.buildQuadrantBuckets(resetTasks)
    })
    this.dragCache = {}
  },

  onToggleSelect(event) {
    const { id } = event.currentTarget.dataset
    if (!id) {
      return
    }
    const selected = new Set(this.data.selectedTaskIds || [])
    if (selected.has(id)) {
      selected.delete(id)
    } else {
      selected.add(id)
    }
    const selectedArray = Array.from(selected)
    const updatedTasks = this.data.activeTasks.map(task => ({
      ...task,
      selected: selected.has(task.id)
    }))
    this.setData({
      selectedTaskIds: selectedArray,
      activeTasks: updatedTasks,
      quadrantBuckets: this.buildQuadrantBuckets(updatedTasks)
    })
  },

  onBatchComplete() {
    const ids = this.data.selectedTaskIds || []
    if (!ids.length) {
      return
    }
    ids.forEach(id => {
      app.updateTask(id, { completed: true })
    })
    wx.showToast({
      title: `已完成${ids.length}项`,
      icon: 'success'
    })
    this.setData({
      selectedTaskIds: [],
      batchMode: false
    })
    this.refreshData()
  },

  onBatchDelete() {
    const ids = this.data.selectedTaskIds || []
    if (!ids.length) {
      return
    }
    wx.showModal({
      title: '删除任务',
      content: `确定删除选中的 ${ids.length} 个任务吗？`,
      confirmColor: '#EF4444',
      success: result => {
        if (!result.confirm) {
          return
        }
        ids.forEach(id => app.deleteTask(id))
        wx.showToast({
          title: '已删除',
          icon: 'success'
        })
        this.setData({
          selectedTaskIds: [],
          batchMode: false
        })
        this.refreshData()
      }
    })
  },

  onCardTap(event) {
    const { id } = event.currentTarget.dataset
    if (!id) {
      return
    }
    if (this.data.batchMode) {
      this.onToggleSelect(event)
      return
    }
    if (this.lastDragId === id && Date.now() - this.lastDragTime < 200) {
      return
    }
    wx.navigateTo({
      url: `/pages/edit-task/edit-task?id=${id}`
    })
  },

  onCompleteTap(event) {
    const { id } = event.currentTarget.dataset
    if (!id) {
      return
    }
    const updated = app.updateTask(id, { completed: true })
    if (updated) {
      wx.showToast({
        title: '任务已完成',
        icon: 'success'
      })
      this.refreshData()
    }
  },

  onCardChange(event) {
    if (this.data.viewMode !== 'expanded' || this.data.batchMode) {
      return
    }
    const { id } = event.currentTarget.dataset
    const { x, y, source } = event.detail
    if (!id || source !== 'touch') {
      return
    }
    this.dragCache[id] = { x, y }
    this.lastDragId = id
    this.lastDragTime = Date.now()
    this.updateTaskPositionInState(id, x, y)
  },

  onCardTouchEnd(event) {
    if (this.data.viewMode !== 'expanded' || this.data.batchMode) {
      return
    }
    const { id } = event.currentTarget.dataset
    if (!id || !this.dragCache[id]) {
      return
    }
    const { x, y } = this.dragCache[id]
    delete this.dragCache[id]
    this.applyScoreUpdate(id, x, y)
  },

  updateTaskPositionInState(id, x, y) {
    const scores = this.scoresFromPosition(x, y)
    const updatedTasks = this.data.activeTasks.map(task => {
      if (task.id !== id) {
        return task
      }
      const quadrant = getQuadrantFromScores(
        scores.importance,
        scores.urgency,
        this.data.threshold
      )
      return {
        ...task,
        position: { x, y },
        importance: scores.importance,
        urgency: scores.urgency,
        quadrant,
        recommendation:
          QUADRANT_TITLES[quadrant] ||
          getQuadrantRecommendation(scores.importance, scores.urgency)
      }
    })
    this.setData({
      activeTasks: updatedTasks,
      quadrantStats: this.buildQuadrantStats(updatedTasks),
      quadrantBuckets: this.buildQuadrantBuckets(updatedTasks)
    })
  },

  applyScoreUpdate(id, x, y) {
    const scores = this.scoresFromPosition(x, y)
    const updated = app.updateTaskQuadrant(
      id,
      scores.importance,
      scores.urgency
    )
    if (updated) {
      wx.showToast({
        title: '已更新任务属性',
        icon: 'success',
        duration: 800
      })
      this.refreshData()
    } else {
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      })
    }
  },

  scoresFromPosition(x, y) {
    const { maxPosition } = this.data
    const importanceRatio =
      maxPosition.x > 0 ? Math.min(Math.max(x / maxPosition.x, 0), 1) : 0
    const urgencyRatio =
      maxPosition.y > 0 ? Math.min(Math.max(y / maxPosition.y, 0), 1) : 0
    return {
      importance: clampScore(importanceRatio * 100),
      urgency: clampScore(100 - urgencyRatio * 100)
    }
  },

  onShowCompletedDetail(event) {
    const { id } = event.currentTarget.dataset
    if (!id) {
      return
    }
    wx.navigateTo({
      url: `/pages/edit-task/edit-task?id=${id}`
    })
  }
})
