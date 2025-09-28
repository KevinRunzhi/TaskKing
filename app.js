App({
  globalData: {
    tasks: []
  },

  onLaunch() {
    this.loadTasks()
  },

  loadTasks() {
    try {
      const tasks = wx.getStorageSync('tasks')
      if (tasks) {
        this.globalData.tasks = tasks
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
    task.id = Date.now().toString()
    task.createdAt = new Date().toISOString()
    this.globalData.tasks.push(task)
    this.saveTasks()
  },

  updateTask(id, updatedTask) {
    const index = this.globalData.tasks.findIndex(task => task.id === id)
    if (index !== -1) {
      this.globalData.tasks[index] = { ...this.globalData.tasks[index], ...updatedTask }
      this.saveTasks()
    }
  },

  deleteTask(id) {
    this.globalData.tasks = this.globalData.tasks.filter(task => task.id !== id)
    this.saveTasks()
  },

  getTasks() {
    return this.globalData.tasks
  }
})