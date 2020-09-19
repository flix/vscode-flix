
/**
 * @enum
 * 
 * Request types matching that of the LSP implementation.
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
  lspCodelens = 'lsp/codelens', // TODO
  lspComplete = 'lsp/complete', // TODO
  lspHover = 'lsp/hover',
  lspSelectionRange = 'lsp/selectionRange', // TODO
  lspFoldingRange = 'lsp/foldingRange', // TODO
  lspGoto = 'lsp/goto',
  lspSymbols = 'lsp/symbols', // TODO
  lspUses = 'lsp/uses', // TODO

  pkgBenchmark = 'pkg/benchmark', // TODO
  pkgBuild = 'pkg/build', // TODO
  pkgBuildDoc = 'pkg/buildDoc', // TODO
  pkgBuildJar = 'pkg/buildJar', // TODO
  pkgBuildPkg = 'pkg/buildPkg', // TODO
  pkgInit = 'pkg/init', // TODO
  pkgTest = 'pkg/test' // TODO
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
