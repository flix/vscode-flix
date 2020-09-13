import * as jobs from './jobs'
import * as socket from './socket'
import { fileURLToPath } from 'url'

const _ = require('lodash/fp')
const fs = require('fs')

let jobCounter = 0

let priorityQueue: jobs.EnqueuedJob[] = []
let taskQueue: jobs.EnqueuedJob[] = []

let queueRunning = false

export function enqueue (job: jobs.Job): jobs.EnqueuedJob {
  const id = `${jobCounter++}`
  const enqueuedJob = { ...job, id }
  jobs.setJob(id, enqueuedJob)
  if (job.request === jobs.Request.addUri || job.request === jobs.Request.remUri) {
    priorityQueue.push(enqueuedJob)
    console.warn(`[debug] added job to priority queue`, enqueuedJob.request)
  } else {
    taskQueue.push(enqueuedJob)
    console.warn(`[debug] added job to task queue`, enqueuedJob.request)
  }
  startQueue()
  return enqueuedJob
}

export function enqueueMany (jobArray: [jobs.Job]) {
  _.each(enqueue, jobArray)
  enqueue(jobs.createCheck())
}

function dequeue () {
  if (_.isEmpty(priorityQueue)) {
    if (_.isEmpty(taskQueue)) {
      return undefined
    }
    const first = _.first(taskQueue)
    taskQueue.shift()
    return first
  } else {
    // priorityQueue has items
    const first = _.first(priorityQueue)
    priorityQueue.shift()
    return first
  }
}

function startQueue () {
  console.warn('[debug] startQueue', queueRunning)
  if (queueRunning) {
    return
  }
  queueRunning = true
  processQueue()
}

export async function processQueue () {
  const job: jobs.EnqueuedJob = dequeue()
  if (job) {
    try {
      if (job.request === jobs.Request.addUri && !job.src) {
        const src = fs.readFileSync(fileURLToPath(job.uri!), 'utf8')
        socket.sendMessage({ ...job, src })
      } else {
        socket.sendMessage(job)
      }
    } catch (err) {
      console.error('Could not read file in queue', job)
    }
  } else {
    console.log('[debug] Queue empty')
    queueRunning = false
  }
}
