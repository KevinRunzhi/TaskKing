const DEFAULT_CATEGORIES = [
  { id: 'study', name: '学习', color: '#6366F1', icon: '📚' },
  { id: 'work', name: '工作', color: '#F97316', icon: '💼' },
  { id: 'life', name: '生活', color: '#22C55E', icon: '🏡' }
]

const COLOR_OPTIONS = [
  '#6366F1',
  '#F97316',
  '#22C55E',
  '#EC4899',
  '#0EA5E9',
  '#FACC15',
  '#10B981',
  '#8B5CF6'
]

const ICON_OPTIONS = ['📚', '💼', '🏡', '🧠', '📈', '🛠️', '💡', '🎯', '📝', '✅']

function createCategory(data = {}) {
  const now = Date.now().toString()

  return normalizeCategory({
    id: data.id || now,
    name: (data.name || '').trim() || '未命名分类',
    color: data.color || COLOR_OPTIONS[0],
    icon: data.icon || ICON_OPTIONS[0],
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString()
  })
}

function normalizeCategory(category) {
  if (!category) return null

  const normalized = { ...category }
  normalized.id = (normalized.id || '').toString()
  normalized.name = (normalized.name || '').trim() || '未命名分类'
  normalized.color = normalized.color || COLOR_OPTIONS[0]
  normalized.icon = normalized.icon || ICON_OPTIONS[0]
  normalized.createdAt = normalized.createdAt || new Date().toISOString()
  normalized.updatedAt = normalized.updatedAt || normalized.createdAt

  return normalized
}

function getDefaultCategories() {
  return DEFAULT_CATEGORIES.map(category => createCategory(category))
}

module.exports = {
  COLOR_OPTIONS,
  ICON_OPTIONS,
  DEFAULT_CATEGORIES,
  getDefaultCategories,
  createCategory,
  normalizeCategory
}
