
/**
 * @enum
 * 
 * Request types matching that of the LSP implementation.
 * 
 * NOTE: This is mirrored ("shared") between client and server by way of carbon copy. 
 * 
 * @see https://github.com/flix/flix/blob/b4b9041cc89b8be04c173ce0b0f58a69e6993739/main/src/ca/uwaterloo/flix/api/lsp/LanguageServer.scala#L163
 */
export enum Request {
  apiAddUri = 'api/addUri',
  apiRemUri = 'api/remUri',
  apiVersion = 'api/version', // TODO
  apiShutdown = 'api/shutdown', // TODO

  cmdRunBenchmarks = 'cmd/runBenchmarks', // TODO
  cmdRunMain = 'cmd/runMain', // TODO
  cmdRunTests = 'cmd/runTests', // TODO

  lspCheck = 'lsp/check',
  lspCodelens = 'lsp/codelens',
  lspHover = 'lsp/hover',
  lspSelectionRange = 'lsp/selectionRange',
  lspGoto = 'lsp/goto',
  lspUses = 'lsp/uses',

  pkgBenchmark = 'pkg/benchmark', // TODO
  pkgBuild = 'pkg/build', // TODO
  pkgBuildDoc = 'pkg/buildDoc', // TODO
  pkgBuildJar = 'pkg/buildJar', // TODO
  pkgBuildPkg = 'pkg/buildPkg', // TODO
  pkgInit = 'pkg/init', // TODO
  pkgTest = 'pkg/test', // TODO

  internalRestart = 'ext/restart', // Internal Extension Request
  internalReady = 'ext/ready', // Internal Extension Request
  internalMessage = 'ext/message', // Internal Extension Request
  internalError = 'ext/error' // Internal Extension Request
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
    request: Request.lspCheck
  }
}
