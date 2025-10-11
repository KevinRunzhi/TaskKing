const app = getApp()

const RANGE_TABS = [
  { key: 'today', label: '今天' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' }
]

function pad(value) {
  return String(value).padStart(2, '0')
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function toDateKey(date) {
  return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-')
}

function safeCompletionDate(isoString) {
  if (!isoString) {
    return null
  }
  const parsed = new Date(isoString)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  const normalized = startOfDay(parsed)
  return {
    dateObj: normalized,
    dateKey: toDateKey(normalized)
  }
}

Page({
  data: {
    rangeTabs: RANGE_TABS,
    activeRange: 'week',
    stats: {
      rangeLabel: '',
      completedCount: 0,
      completedHint: '',
      streak: 0,
      streakHint: '',
      highlightDate: '',
      highlightLabel: '',
      highlightCount: 0,
      encouragementIcon: '🌱',
      encouragementText: '每一天都是新的开始'
    }
  },

  onShow() {
    this.refreshStats()
  },

  onPullDownRefresh() {
    this.refreshStats(() => wx.stopPullDownRefresh())
  },

  onRangeTabTap(event) {
    const { key } = event.currentTarget.dataset
    if (!key || key === this.data.activeRange) {
      return
    }
    this.setData({ activeRange: key }, () => {
      this.refreshStats()
    })
  },

  refreshStats(callback) {
    const tasks = app.getTasks()

    const completions = (tasks || []).reduce((result, task) => {
      if (!task || !task.completed) {
        return result
      }

      const completion =
        safeCompletionDate(task.completedAt || task.updatedAt || task.dueDateTime || '') ||
        safeCompletionDate(task.updatedAt || task.createdAt || '')

      if (completion) {
        result.push(completion)
      }

      return result
    }, [])

    const range = this.getRangeBounds(this.data.activeRange)
    const filtered = completions.filter(item => {
      const time = item.dateObj.getTime()
      return time >= range.start.getTime() && time <= range.end.getTime()
    })

    const completedCount = filtered.length
    const streak = this.calculateStreak(completions)
    const highlight = this.calculateHighlight(filtered)
    const highlightInfo = highlight ? this.buildHighlightLabel(highlight.count) : { icon: '', text: '' }

    const encouragement = this.buildEncouragement(
      this.data.activeRange,
      completedCount,
      streak
    )

    const stats = {
      rangeLabel: this.formatRangeLabel(this.data.activeRange, range),
      completedCount,
      completedHint: this.buildCompletedHint(completedCount, this.data.activeRange),
      streak,
      streakHint: this.buildStreakHint(streak),
      highlightDate: highlight ? this.formatMonthDay(highlight.dateObj) : '',
      highlightLabel: highlight ? `${highlightInfo.icon} ${highlightInfo.text}`.trim() : '',
      highlightCount: highlight ? highlight.count : 0,
      encouragementIcon: encouragement.icon,
      encouragementText: encouragement.text
    }

    this.setData({ stats }, () => {
      if (typeof callback === 'function') {
        callback()
      }
    })
  },

  getRangeBounds(rangeKey) {
    const now = new Date()
    const todayStart = startOfDay(now)

    switch (rangeKey) {
      case 'today': {
        return {
          start: todayStart,
          end: endOfDay(todayStart)
        }
      }
      case 'month': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1)
        const end = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0))
        return { start, end }
      }
      case 'week':
      default: {
        const day = todayStart.getDay()
        const offset = day === 0 ? 6 : day - 1
        const start = new Date(todayStart)
        start.setDate(start.getDate() - offset)
        const end = endOfDay(new Date(start))
        end.setDate(end.getDate() + 6)
        return { start, end }
      }
    }
  },

  calculateStreak(completions) {
    if (!Array.isArray(completions) || completions.length === 0) {
      return 0
    }

    const completedDays = new Set(completions.map(item => item.dateKey))
    let streak = 0
    let pointer = startOfDay(new Date())

    while (true) {
      const key = toDateKey(pointer)
      if (completedDays.has(key)) {
        streak += 1
        pointer = new Date(pointer)
        pointer.setDate(pointer.getDate() - 1)
      } else {
        break
      }
    }

    return streak
  },

  calculateHighlight(completions) {
    if (!Array.isArray(completions) || completions.length === 0) {
      return null
    }

    const counts = completions.reduce((map, item) => {
      const { dateKey, dateObj } = item
      if (!dateKey) {
        return map
      }
      const previous = map.get(dateKey) || { count: 0, dateObj }
      map.set(dateKey, {
        count: previous.count + 1,
        dateObj: previous.dateObj
      })
      return map
    }, new Map())

    let best = null
    counts.forEach((value, key) => {
      if (!best) {
        best = { key, ...value }
        return
      }

      if (value.count > best.count) {
        best = { key, ...value }
        return
      }

      if (value.count === best.count && key > best.key) {
        best = { key, ...value }
      }
    })

    return best
  },

  buildHighlightLabel(count) {
    if (count >= 5) {
      return { icon: '🚀', text: '能量满格' }
    }
    if (count >= 3) {
      return { icon: '💪', text: '高效一天' }
    }
    if (count >= 1) {
      return { icon: '🌿', text: '温柔推进' }
    }
    return { icon: '', text: '' }
  },

  buildCompletedHint(count, rangeKey) {
    if (count === 0) {
      switch (rangeKey) {
        case 'today':
          return '今天可以好好休息，保持温柔的节奏。'
        case 'week':
          return '本周仍在酝酿能量，慢慢来就很好。'
        case 'month':
          return '这个月可以轻装上阵，循序渐进也很棒。'
        default:
          return '保持自己的节奏，就已经很不错。'
      }
    }

    if (count === 1) {
      return '悄悄完成了 1 件事，迈出扎实一步。'
    }

    if (count <= 3) {
      return `这一段完成了 ${count} 件事，节奏刚刚好。`
    }

    return `累计完成 ${count} 件任务，保持住这份动力！`
  },

  buildStreakHint(streak) {
    if (streak === 0) {
      return '可以从今天开始记录新的坚持。'
    }

    if (streak === 1) {
      return '今天的完成点亮了新的一天！'
    }

    if (streak < 5) {
      return `已经连续 ${streak} 天有任务完成，继续保持。`
    }

    return `连续 ${streak} 天保持行动力，厉害！`
  },

  buildEncouragement(rangeKey, count, streak) {
    if (count === 0) {
      return {
        icon: '✨',
        text: '留一点空白给自己，充电的日子同样宝贵。'
      }
    }

    if (streak >= 7) {
      return {
        icon: '🔥',
        text: `已经坚持 ${streak} 天，状态稳稳在线！`
      }
    }

    if (count >= 5) {
      return {
        icon: '💡',
        text: '完成任务的节奏很赞，保持这份专注～'
      }
    }

    if (rangeKey === 'today' && count >= 2) {
      return {
        icon: '🎉',
        text: '今天的收获满满，给自己一个小奖励吧！'
      }
    }

    return {
      icon: '🌱',
      text: '一点一滴的积累，会长成你想要的模样。'
    }
  },

  formatRangeLabel(rangeKey, range) {
    switch (rangeKey) {
      case 'today':
        return `今天 · ${this.formatMonthDay(range.start)}`
      case 'month':
        return `本月 · ${range.start.getFullYear()}年${range.start.getMonth() + 1}月`
      case 'week':
      default: {
        return `本周 · ${this.formatShortDate(range.start)} - ${this.formatShortDate(range.end)}`
      }
    }
  },

  formatMonthDay(date) {
    return `${date.getMonth() + 1}月${date.getDate()}日`
  },

  formatShortDate(date) {
    return `${pad(date.getMonth() + 1)}.${pad(date.getDate())}`
  }
})
