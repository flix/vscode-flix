import {
  InitializeParams, 
  InitializeResult,
  TextDocumentSyncKind
} from 'vscode-languageserver'

import { TextDocument } from 'vscode-languageserver-textdocument'

import * as jobs from '../engine/jobs'
import * as queue from '../engine/queue'
import * as engine from '../engine'
import * as socket from '../engine/socket'

interface UriInput {
  uri: string
}

export function handleInitialize (_params: InitializeParams) {
  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      hoverProvider: true,
      definitionProvider: true,
      referencesProvider: true,
      codeLensProvider: {
        resolveProvider: true
      }
    }
  }
  return result
}

/**
 * Runs when both client and server are ready.
 */
export function handleReady (engineInput: engine.StartEngineInput) {
  engine.start(engineInput)
}

export function handleAddUri ({ uri }: UriInput) {
  engine.addUri(uri)
}

export function handleRemUri ({ uri }: UriInput) {
  engine.remUri(uri)
}

export function handleExit () {
  engine.stop()
}

export function handleChangeContent (listener: any) {
  const document: TextDocument = listener.document
  const job: jobs.Job = {
    request: jobs.Request.apiAddUri,
    uri: document.uri, // Note: this typically has the file:// scheme (important for files as keys)
    src: document.getText()
  }
  queue.enqueue(job)
  queue.enqueue(jobs.createCheck())
}

function makeDefaultResponseHandler (promiseResolver: Function) {
  return function responseHandler ({ status, result }: socket.FlixResponse, ) {
    if (status === 'success') {
      promiseResolver(result)
    } else {
      promiseResolver()
    }
  }
}

function makeEnqueuePromise (type: jobs.Request, makeResponseHandler?: Function, uri?: string, position?: any) {
  return function enqueuePromise () {
    return new Promise(function (resolve) {
      const job = engine.enqueueJobWithPosition(type, uri, position)
      const handler = makeResponseHandler || makeDefaultResponseHandler
      socket.eventEmitter.once(job.id, handler(resolve))
    })
  }
}

function makePositionalHandler (type: jobs.Request, makeResponseHandler?: Function) {
  return function positionalHandler (params: any): Thenable<any> {
    const uri = params.textDocument ? params.textDocument.uri : undefined
    const position = params.position
    return makeEnqueuePromise(type, makeResponseHandler, uri, position)()
  }
}

/**
 * @function
 */
export const handleGotoDefinition = makePositionalHandler(jobs.Request.lspGoto)

/**
 * @function
 */
export const handleHover = makePositionalHandler(jobs.Request.lspHover)

/**
 * @function
 */
export const handleReferences = makePositionalHandler(jobs.Request.lspUses)

/**
 * @function
 */
export const handleCodelens = makePositionalHandler(jobs.Request.lspCodelens)

function makeRunBenchmarksResponseHandler (promiseResolver: Function) {
  return function responseHandler ({ status, result }: socket.FlixResponse, ) {
    if (status === 'success') {
      promiseResolver(result)
    } else {
      promiseResolver()
    }
  }
}

/**
 * @function
 */
export const handleRunBenchmarks = makeEnqueuePromise(jobs.Request.cmdRunBenchmarks, makeRunBenchmarksResponseHandler)

function makeRunMainResponseHandler (promiseResolver: Function) {
  return function responseHandler ({ status, result }: socket.FlixResponse, ) {
    if (status === 'success') {
      promiseResolver(result)
    } else {
      promiseResolver()
    }
  }
}

/**
 * @function
 */
export const handleRunMain = makeEnqueuePromise(jobs.Request.cmdRunMain, makeRunMainResponseHandler)

function makeRunTestsResponseHandler (promiseResolver: Function) {
  return function responseHandler ({ status, result }: socket.FlixResponse, ) {
    if (status === 'success') {
      promiseResolver(result)
    } else {
      promiseResolver()
    }
  }
}

/**
 * @function
 */
export const handleRunTests = makeEnqueuePromise(jobs.Request.cmdRunTests, makeRunTestsResponseHandler)
