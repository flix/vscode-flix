export enum Request {
  check = 'lsp/check',
  hover = 'lsp/hover',
  goto = 'lsp/goto',
  addUri = 'api/addUri',
  remUri = 'api/remUri'
}

export interface Position {
  line: number
  character: number
}

export interface Job {
  request: Request
  uri?: string
  src?: string
  position?: Position
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

export function createCheck (): Job {
  return {
    request: Request.check
  }
}
