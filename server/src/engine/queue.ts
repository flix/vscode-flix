/*
 * Copyright 2020 Thomas Plougsgaard
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as engine from './flix'
import * as jobs from './jobs'
import * as socket from './socket'
import { fileURLToPath } from 'url'
import { sendNotification } from '../server'
import { USER_MESSAGE } from '../util/userMessages'

const _ = require('lodash/fp')
const fs = require('fs')

let jobCounter = 0
let queueRunning = false

let priorityQueue: jobs.EnqueuedJob[] = []
let taskQueue: jobs.EnqueuedJob[] = []

let waitingForPriorityQueue: jobs.JobMap = {
  // uri -> job
}

function isPriorityJob (job: jobs.Job) {
  return (job.request === jobs.Request.apiAddUri || job.request === jobs.Request.apiRemUri 
    || job.request == jobs.Request.apiAddPkg || job.request == jobs.Request.apiRemPkg
    || job.request == jobs.Request.apiAddJar || job.request == jobs.Request.apiRemJar)
}

function jobToEnqueuedJob (job: jobs.Job) {
  const id = `${jobCounter++}`
  const enqueuedJob = { ...job, id }
  jobs.setJob(id, enqueuedJob)
  return enqueuedJob
}

function emptyWaitingForPriorityQueue () {
  const values = _.values(waitingForPriorityQueue)
  waitingForPriorityQueue = {}
  return values
}

let enqueueDebounced: Function = makeEnqueueDebounced()

function handleEnqueue () {
  if (_.isEmpty(waitingForPriorityQueue)) {
    return
  }
  priorityQueue.push(...emptyWaitingForPriorityQueue())
  startQueue()
}

function makeEnqueueDebounced () {
  return _.debounce(engine.compileOnChangeDelay(), handleEnqueue, {'leading': true, 'trailing': true})
}

export function resetEnqueueDebounced () {
  enqueueDebounced = makeEnqueueDebounced()
}

function enqueueWithPriority (job: jobs.EnqueuedJob, skipDelay?: boolean) {
  waitingForPriorityQueue[job.uri!] = job
  if (skipDelay) {
    handleEnqueue()
  } else {
    enqueueDebounced()
  }
  return job
}

export function enqueue (job: jobs.Job, skipDelay?: boolean): jobs.EnqueuedJob {
  const enqueuedJob = jobToEnqueuedJob(job)

  if (isPriorityJob(enqueuedJob)) {
    return enqueueWithPriority(enqueuedJob, skipDelay)
  }

  if (job.request === jobs.Request.lspCheck) {
    // there's a special rule for lsp/check:
    // there can only be one and it has to be in the beginning
    taskQueue = _.reject({ request: jobs.Request.lspCheck }, taskQueue)
    taskQueue.unshift(enqueuedJob)
  } else {
    taskQueue.push(enqueuedJob)
  }

  startQueue()
  return enqueuedJob
}

/**
 * Initialises the queues.
 *
 * @param jobs
 */
export function initialiseQueues(jobs: jobs.Job[]) {
  resetEnqueueDebounced()
  queueRunning = false // make sure `startQueue` actually starts it
  for (const job of jobs) {
    const enqueuedJob = jobToEnqueuedJob(job)
    if (isPriorityJob(job)) {
      priorityQueue.push(enqueuedJob)
    } else {
      taskQueue.push(enqueuedJob)
    }
  }
  startQueue()
}

/**
 * Takes the first item off priorityQueue if it has items.
 * If the last item is taken from priorityQueue, append lsp/check to first position in taskQueue.
 * Otherwise take the first item off taskQueue.
 */
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
    if (_.isEmpty(priorityQueue)) {
      enqueue({
        request: jobs.Request.lspCheck
      })
    }
    return first
  }
}

function startQueue () {
  if (queueRunning) {
    return
  }
  queueRunning = true
  processQueue()
}

function emptyQueue () {
  priorityQueue = []
  taskQueue = []
  queueRunning = false
}

export async function processQueue () {
  // console.warn('[[debug:ProcessQueue]]: ' + _.map('request', priorityQueue).join(', ') + ' || ' + _.map('request', taskQueue).join(', '))
  if (!engine.isRunning()) {
    // VSCode might ask us to do things before we're up and running - wait for next processQueue call
    return
  }
  const job: jobs.EnqueuedJob = dequeue()
  if (job) {
    try {
      if (job.request === jobs.Request.apiAddUri && !job.src) {
        const src = fs.readFileSync(fileURLToPath(job.uri!), 'utf8')
        socket.sendMessage({ ...job, src })
      } else if(job.request == jobs.Request.apiAddPkg && !job.src) {
        const base64 = fs.readFileSync(fileURLToPath(job.uri!)).toString('base64')
        socket.sendMessage({...job, base64 })
      } else {
        socket.sendMessage(job)
      }
    } catch (err) {
      const errorMessage = USER_MESSAGE.failed_to_read_file(job.uri || "", err)
      sendNotification(jobs.Request.internalError, errorMessage)
    }
  } else {
    queueRunning = false
  }
}

export async function terminateQueue () {
  const id = 'shutdown'
  const job: jobs.EnqueuedJob = {
    id,
    request: jobs.Request.apiShutdown
  }
  socket.sendMessage(job)
  await new Promise(resolve => {
    socket.eventEmitter.once(id, resolve)
  })
  emptyQueue()
}
