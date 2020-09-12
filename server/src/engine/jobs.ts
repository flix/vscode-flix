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

export function setJob(id: string, job: EnqueuedJob) {
  jobs[id] = job
}

export function getJob (id: string) {
  return jobs[id]
}
