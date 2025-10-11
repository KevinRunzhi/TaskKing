const REMINDER_TEMPLATE_ID = '请在此填写你的订阅消息模板ID'
const REMINDER_TARGET_PAGE = 'pages/index/index'

function isReminderTemplateConfigured() {
  return (
    !!REMINDER_TEMPLATE_ID &&
    !REMINDER_TEMPLATE_ID.startsWith('请在此填写') &&
    REMINDER_TEMPLATE_ID !== 'YOUR_TEMPLATE_ID'
  )
}

function truncate(value, length) {
  if (!value) return ''
  if (value.length <= length) return value
  return value.slice(0, length)
}

function buildDateTimeLabel(date, time) {
  if (!date) return ''
  return `${date}${time ? ` ${time}` : ''}`
}

function buildSubscribeMessageData(task) {
  const title = truncate(task.title || '', 20) || '任务提醒'
  const description = truncate(task.description || '请及时关注任务进度', 20)
  const reminderLabel = buildDateTimeLabel(
    task.reminderDate,
    task.reminderTime
  )
  const dueLabel = buildDateTimeLabel(task.dueDate, task.dueTime)

  // 使用示例字段名，需根据实际订阅消息模板调整
  return {
    thing1: { value: title },
    time2: { value: reminderLabel || dueLabel || '' },
    thing3: { value: description }
  }
}

function requestReminderSubscription() {
  if (!isReminderTemplateConfigured()) {
    return Promise.resolve(false)
  }

  return new Promise(resolve => {
    wx.requestSubscribeMessage({
      tmplIds: [REMINDER_TEMPLATE_ID],
      success: res => {
        resolve(res[REMINDER_TEMPLATE_ID] === 'accept')
      },
      fail: () => {
        resolve(false)
      }
    })
  })
}

module.exports = {
  REMINDER_TEMPLATE_ID,
  REMINDER_TARGET_PAGE,
  isReminderTemplateConfigured,
  requestReminderSubscription,
  buildSubscribeMessageData
}
