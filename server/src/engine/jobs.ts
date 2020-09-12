import * as socket from './socket'

const _ = require('lodash/fp')

export enum Request {
  check = 'lsp/check',
  addUri = 'api/addUri',
  remUri = 'api/remUri'
}

export interface Job {
  request: Request
  uri: string
  src?: string
}

export interface EnqueuedJob extends Job {
  id: string
}

interface JobMap {
  [id: string]: EnqueuedJob
}

let jobs: JobMap = {}

let jobCounter = 0

let queue: EnqueuedJob[] = []

export function enqueue (job: Job) {
  const id = `${jobCounter++}`
  const enqueuedJob = { ...job, id }
  jobs[id] = enqueuedJob
  queue.push(enqueuedJob)
  console.warn(`[debug] added job`, enqueuedJob)
  socket.startQueue()
}

export function enqueueMany (jobs: [Job]) {
  _.each(enqueue, jobs)
}

export function dequeue () {
  if (_.isEmpty(queue)) {
    return undefined
  }
  const first = _.first(queue)
  queue.shift()
  return first
}

export function getJob (id: string) {
  return jobs[id]
}
