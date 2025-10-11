const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const remindersCollection = db.collection('reminders')
const command = db.command

async function upsertReminder(event) {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) {
    throw new Error('Missing OPENID in context')
  }

  const { taskId, reminderDateTime, templateId } = event

  if (!taskId) {
    return {
      success: false,
      error: 'taskId is required'
    }
  }

  // 移除旧的提醒
  await remindersCollection
    .where({
      taskId,
      openid
    })
    .remove()

  if (!reminderDateTime || !templateId) {
    return {
      success: true,
      removed: true
    }
  }

  const now = new Date()

  const reminderData = {
    taskId,
    openid,
    templateId,
    page: event.page || 'pages/index/index',
    title: event.title || '',
    priority: event.priority || '',
    reminderDateTime,
    dueDateTime: event.dueDateTime || '',
    messageData: event.messageData || {},
    status: 'pending',
    createdAt: now,
    updatedAt: now
  }

  await remindersCollection.add({
    data: reminderData
  })

  return {
    success: true
  }
}

async function removeReminder(event) {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { taskId } = event

  if (!taskId) {
    return {
      success: false,
      error: 'taskId is required'
    }
  }

  await remindersCollection
    .where({
      taskId,
      openid
    })
    .remove()

  return {
    success: true
  }
}

async function processReminders() {
  const now = new Date().toISOString()

  const pendingReminders = await remindersCollection
    .where({
      status: 'pending',
      reminderDateTime: command.lte(now)
    })
    .get()

  if (!pendingReminders.data.length) {
    return {
      success: true,
      processed: 0
    }
  }

  const results = []

  for (const reminder of pendingReminders.data) {
    try {
      await cloud.openapi.subscribeMessage.send({
        touser: reminder.openid,
        templateId: reminder.templateId,
        page: reminder.page || 'pages/index/index',
        data: reminder.messageData || {}
      })

      await remindersCollection.doc(reminder._id).update({
        data: {
          status: 'sent',
          sentAt: new Date(),
          updatedAt: new Date()
        }
      })

      results.push({
        taskId: reminder.taskId,
        status: 'sent'
      })
    } catch (error) {
      console.error('Failed to send reminder:', reminder.taskId, error)

      await remindersCollection.doc(reminder._id).update({
        data: {
          status: 'failed',
          failReason: error.message || 'unknown error',
          updatedAt: new Date()
        }
      })

      results.push({
        taskId: reminder.taskId,
        status: 'failed',
        error: error.message
      })
    }
  }

  return {
    success: true,
    processed: results.length,
    results
  }
}

exports.main = async event => {
  const { action } = event || {}

  switch (action) {
    case 'upsert':
      return upsertReminder(event)
    case 'remove':
      return removeReminder(event)
    case 'process':
      return processReminders(event)
    default:
      return {
        success: false,
        error: `Unknown action: ${action}`
      }
  }
}
