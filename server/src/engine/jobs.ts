const _ = require('lodash/fp')

let counter = 0

export interface Job {
  request: string
  uri: string
  src?: string
}

export interface EnqueuedJob extends Job {
  id: string
}

interface JobMap {
  [id: string]: EnqueuedJob
}

export let jobs: JobMap = {}

let queue: EnqueuedJob[] = []

export function enqueue (job: Job) {
  const id = `${counter++}`
  const enqueuedJob = { ...job, id }
  jobs[id] = enqueuedJob
  queue.push(enqueuedJob)
  console.warn(`[debug] added job`, enqueuedJob)
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
