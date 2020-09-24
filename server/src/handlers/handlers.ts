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

function makeEnqueuePromise (type: jobs.Request, uri?: string, position?: any) {
  return function enqueuePromise () {
    return new Promise(function handler (resolve) {
      const job = engine.enqueueJobWithPosition(type, uri, position)
      socket.eventEmitter.once(job.id, ({ status, result }) => {
        if (status === 'success') {
          resolve(result)
        } else {
          resolve()
        }
      })
    })
  }
}

function makePositionalHandler (type: jobs.Request) {
  return function positionalHandler (params: any): Thenable<any> {
    const uri = params.textDocument ? params.textDocument.uri : undefined
    const position = params.position
    return makeEnqueuePromise(type, uri, position)()
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
