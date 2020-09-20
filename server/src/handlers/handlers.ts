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
      foldingRangeProvider: true,
      selectionRangeProvider: true,
      workspaceSymbolProvider: true,
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

function makePositionalHandler (type: jobs.Request) {
  return function positionalHandler (params: any): Thenable<any> {
    return new Promise(function handler (resolve) {
      // some jobs (e.g. symbols) don't have uris
      const uri = params.textDocument ? params.textDocument.uri : undefined
      const job = engine.enqueueJobWithPosition(type, uri, params.position)
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
export const handleCompletion = makePositionalHandler(jobs.Request.lspComplete)

/**
 * @function
 */
export const handleFoldingRanges = makePositionalHandler(jobs.Request.lspFoldingRange)

/**
 * @function
 */
export const handleSelectionRanges = makePositionalHandler(jobs.Request.lspSelectionRange)

/**
 * @function
 */
export const handleSymbols = makePositionalHandler(jobs.Request.lspSymbols)

/**
 * @function
 */
export const handleCodelens = makePositionalHandler(jobs.Request.lspCodelens)
