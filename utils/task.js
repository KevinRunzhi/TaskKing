// 任务数据模型和工具函数

// 优先级常量
const PRIORITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
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

// 创建新任务
function createTask(title, description = '', dueDate = '', priority = PRIORITY.MEDIUM) {
  return {
    id: '',
    title: title.trim(),
    description: description.trim(),
    dueDate,
    priority,
    completed: false,
    createdAt: '',
    updatedAt: new Date().toISOString()
  }
}

// 验证任务数据
function validateTask(task) {
  const errors = []

  if (!task.title || task.title.trim().length === 0) {
    errors.push('任务标题不能为空')
  }

  if (task.title && task.title.length > 100) {
    errors.push('任务标题不能超过100个字符')
  }

  if (task.description && task.description.length > 500) {
    errors.push('任务描述不能超过500个字符')
  }

  if (task.dueDate) {
    const dueDate = new Date(task.dueDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (dueDate < today) {
      errors.push('截止日期不能早于今天')
    }
  }

  if (!Object.values(PRIORITY).includes(task.priority)) {
    errors.push('无效的优先级')
  }

  return errors
}

// 格式化日期显示
function formatDate(dateString) {
  if (!dateString) return ''

  const date = new Date(dateString)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // 重置时间到00:00:00以便比较日期
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const tomorrowOnly = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate())

  if (dateOnly.getTime() === todayOnly.getTime()) {
    return '今天'
  } else if (dateOnly.getTime() === tomorrowOnly.getTime()) {
    return '明天'
  } else {
    return `${date.getMonth() + 1}/${date.getDate()}`
  }
}

// 检查任务是否过期
function isOverdue(dateString) {
  if (!dateString) return false

  const dueDate = new Date(dateString)
  const today = new Date()
  today.setHours(23, 59, 59, 999)

  return dueDate < today
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
    // 没有截止日期的任务排在最后
    if (!a.dueDate && !b.dueDate) return 0
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1

    const dateA = new Date(a.dueDate)
    const dateB = new Date(b.dueDate)

    return ascending ? dateA - dateB : dateB - dateA
  })
}

// 按创建时间排序
function sortByCreatedAt(tasks, ascending = false) {
  return [...tasks].sort((a, b) => {
    const dateA = new Date(a.createdAt)
    const dateB = new Date(b.createdAt)
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
    task.title.toLowerCase().includes(searchTerm) ||
    task.description.toLowerCase().includes(searchTerm)
  )
}

// 导出所有函数和常量
module.exports = {
  PRIORITY,
  PRIORITY_LABELS,
  PRIORITY_VALUES,
  createTask,
  validateTask,
  formatDate,
  isOverdue,
  sortByPriority,
  sortByDate,
  sortByCreatedAt,
  filterByCompleted,
  searchTasks
}