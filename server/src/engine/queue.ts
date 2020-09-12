import * as jobs from './jobs'
import * as socket from './socket'

const _ = require('lodash/fp')
const fs = require('fs')

let jobCounter = 0

let queue: jobs.EnqueuedJob[] = []

let queueRunning = false

export function enqueue (job: jobs.Job) {
  const id = `${jobCounter++}`
  const enqueuedJob = { ...job, id }
  jobs.setJob(id, enqueuedJob)
  queue.push(enqueuedJob)
  console.warn(`[debug] added job`, enqueuedJob)
  startQueue()
}

export function enqueueMany (jobs: [jobs.Job]) {
  _.each(enqueue, jobs)
}

function dequeue () {
  if (_.isEmpty(queue)) {
    return undefined
  }
  const first = _.first(queue)
  queue.shift()
  return first
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
  console.warn('[debug] processQueue')
  const job: jobs.EnqueuedJob = dequeue()
  if (job) {
    try {
      if (job.request === jobs.Request.addUri && !job.src) {
        console.warn('[debug] reading jobs.Request.addUri')
        const src = fs.readFileSync(job.uri, 'utf8')
        socket.sendMessage({ ...job, src })
      } else {
        socket.sendMessage(job)
      }
    } catch (err) {
      console.error('Could not read file in queue', job)
    }
  } else {
    console.warn('[debug1] Queue empty')
    queueRunning = false
  }
}
