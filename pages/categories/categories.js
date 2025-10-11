const {
  COLOR_OPTIONS,
  ICON_OPTIONS
} = require('../../utils/category.js')

const app = getApp()

Page({
  data: {
    categories: [],
    colorOptions: COLOR_OPTIONS,
    iconOptions: ICON_OPTIONS,
    newCategory: {
      name: '',
      color: COLOR_OPTIONS[0],
      icon: ICON_OPTIONS[0]
    },
    newCategoryValid: false,
    showEditModal: false,
    editCategoryId: '',
    editForm: {
      name: '',
      color: COLOR_OPTIONS[0],
      icon: ICON_OPTIONS[0]
    },
    editFormValid: false
  },

  onLoad() {
    this.refreshCategories()
  },

  onShow() {
    this.refreshCategories()
  },

  refreshCategories() {
    const categories = app.getCategories()
    const tasks = app.getTasks()

    const categoriesWithCount = categories.map(category => ({
      ...category,
      taskCount: tasks.filter(task => task.categoryId === category.id).length
    }))

    this.setData({ categories: categoriesWithCount })
  },

  onNewNameInput(e) {
    const name = e.detail.value
    this.setData({
      'newCategory.name': name,
      newCategoryValid: name.trim().length > 0
    })
  },

  onNewColorSelect(e) {
    const color = e.currentTarget.dataset.color
    if (!color) return
    this.setData({ 'newCategory.color': color })
  },

  onNewIconSelect(e) {
    const icon = e.currentTarget.dataset.icon
    if (!icon) return
    this.setData({ 'newCategory.icon': icon })
  },

  onCreateCategory() {
    if (!this.data.newCategoryValid) {
      return
    }

    const name = this.data.newCategory.name.trim()
    const color = this.data.newCategory.color
    const icon = this.data.newCategory.icon

    if (!name) {
      wx.showToast({ title: '名称不能为空', icon: 'none' })
      return
    }

    const exists = this.data.categories.some(category => category.name === name)
    if (exists) {
      wx.showToast({ title: '分类名称已存在', icon: 'none' })
      return
    }

    app.addCategory({ name, color, icon })
    wx.showToast({ title: '已添加', icon: 'success' })

    this.setData({
      newCategory: {
        name: '',
        color: COLOR_OPTIONS[0],
        icon: ICON_OPTIONS[0]
      },
      newCategoryValid: false
    })

    this.refreshCategories()
  },

  onEditCategory(e) {
    const id = e.currentTarget.dataset.id
    const category = this.data.categories.find(item => item.id === id)
    if (!category) return

    this.setData({
      showEditModal: true,
      editCategoryId: id,
      editForm: {
        name: category.name,
        color: category.color,
        icon: category.icon
      },
      editFormValid: category.name.trim().length > 0
    })
  },

  onEditNameInput(e) {
    const name = e.detail.value
    this.setData({
      'editForm.name': name,
      editFormValid: name.trim().length > 0
    })
  },

  onEditColorSelect(e) {
    const color = e.currentTarget.dataset.color
    if (!color) return
    this.setData({ 'editForm.color': color })
  },

  onEditIconSelect(e) {
    const icon = e.currentTarget.dataset.icon
    if (!icon) return
    this.setData({ 'editForm.icon': icon })
  },

  onSaveEdit() {
    if (!this.data.editFormValid) {
      return
    }

    const id = this.data.editCategoryId
    const name = this.data.editForm.name.trim()
    const color = this.data.editForm.color
    const icon = this.data.editForm.icon

    if (!name) {
      wx.showToast({ title: '名称不能为空', icon: 'none' })
      return
    }

    const exists = this.data.categories.some(
      category => category.name === name && category.id !== id
    )

    if (exists) {
      wx.showToast({ title: '分类名称已存在', icon: 'none' })
      return
    }

    app.updateCategory(id, {
      name,
      color,
      icon,
      updatedAt: new Date().toISOString()
    })

    wx.showToast({ title: '已更新', icon: 'success' })

    this.setData({
      showEditModal: false,
      editCategoryId: '',
      editForm: {
        name: '',
        color: COLOR_OPTIONS[0],
        icon: ICON_OPTIONS[0]
      },
      editFormValid: false
    })

    this.refreshCategories()
  },

  onCancelEdit() {
    this.setData({
      showEditModal: false,
      editCategoryId: '',
      editForm: {
        name: '',
        color: COLOR_OPTIONS[0],
        icon: ICON_OPTIONS[0]
      },
      editFormValid: false
    })
  },

  onDeleteCategory(e) {
    const id = e.currentTarget.dataset.id

    if (this.data.categories.length <= 1) {
      wx.showToast({ title: '至少保留一个分类', icon: 'none' })
      return
    }

    const category = this.data.categories.find(item => item.id === id)
    const name = category ? category.name : ''

    wx.showModal({
      title: '确认删除',
      content: `确定删除分类"${name}"吗？所属任务将移动到默认分类。`,
      confirmColor: '#ef4444',
      success: res => {
        if (res.confirm) {
          const success = app.deleteCategory(id)
          if (success) {
            wx.showToast({ title: '已删除', icon: 'success' })
            this.refreshCategories()
          } else {
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  },

  preventTouchMove() {
    return
  }
})
