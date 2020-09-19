import {
  Definition,
  DefinitionParams,
  Hover,
  HoverParams,
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
      completionProvider: {
        resolveProvider: true
      },
      hoverProvider: true,
      definitionProvider: true
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

export function handleGotoDefinition (params: DefinitionParams): Thenable<Definition> {
  return new Promise((resolve, _reject) => {
    const job = engine.goto(params.textDocument.uri, params.position)
    socket.eventEmitter.once(job.id, ({ status, result }) => {
      if (status === 'success') {
        resolve(result)
      } else {
        resolve()
      }
    })
  })
}

export function handleHover (params: HoverParams): Thenable<Hover> {
  return new Promise((resolve, _reject) => {
    const job = engine.hover(params.textDocument.uri, params.position)
    socket.eventEmitter.once(job.id, ({ status, result }) => {
      if (status === 'success') {
        resolve(result)
      } else {
        resolve()
      }
    })
  })
}
