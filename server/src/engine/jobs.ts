// https://github.com/flix/flix/blob/b4b9041cc89b8be04c173ce0b0f58a69e6993739/main/src/ca/uwaterloo/flix/api/lsp/LanguageServer.scala#L163

// case JString("api/addUri") => Request.parseAddUri(json)
// case JString("api/remUri") => Request.parseRemUri(json)
// case JString("api/version") => Request.parseVersion(json)
// case JString("api/shutdown") => Request.parseShutdown(json)

// case JString("cmd/runBenchmarks") => Request.parseRunBenchmarks(json)
// case JString("cmd/runMain") => Request.parseRunMain(json)
// case JString("cmd/runTests") => Request.parseRunTests(json)

// case JString("lsp/check") => Request.parseCheck(json)
// case JString("lsp/codelens") => Request.parseCodelens(json)
// case JString("lsp/complete") => Request.parseComplete(json)
// case JString("lsp/hover") => Request.parseHover(json)
// case JString("lsp/selectionRange") => Request.parseSelectionRange(json)
// case JString("lsp/foldingRange") => Request.parseFoldingRange(json)
// case JString("lsp/goto") => Request.parseGoto(json)
// case JString("lsp/symbols") => Request.parseSymbols(json)
// case JString("lsp/uses") => Request.parseUses(json)

// case JString("pkg/benchmark") => Request.parsePackageBenchmark(json)
// case JString("pkg/build") => Request.parsePackageBuild(json)
// case JString("pkg/buildDoc") => Request.parsePackageBuildDoc(json)
// case JString("pkg/buildJar") => Request.parsePackageBuildJar(json)
// case JString("pkg/buildPkg") => Request.parsePackageBuildPkg(json)
// case JString("pkg/init") => Request.parsePackageInit(json)
// case JString("pkg/test") => Request.parsePackageTest(json)

export enum Request {
  lspCheck = 'lsp/check',
  lspHover = 'lsp/hover',
  lspGoto = 'lsp/goto',
  apiAddUri = 'api/addUri',
  apiRemUri = 'api/remUri'
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
