/*
 * Copyright 2020 Thomas Plougsgaard
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  InitializeParams,
  InitializeResult,
  InlayHintParams,
  TextDocumentChangeEvent,
  TextDocumentSyncKind,
} from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'

import * as jobs from '../engine/jobs'
import * as engine from '../engine'
import * as socket from '../engine/socket'

import { clearDiagnostics, sendDiagnostics, sendNotification } from '../server'
import { makePositionalHandler, makeEnqueuePromise, enqueueUnlessHasErrors, makeDefaultResponseHandler } from './util'
import { USER_MESSAGE } from '../util/userMessages'
import { StatusCode } from '../util/statusCodes'

import _ = require('lodash/fp')

interface UriInput {
  uri: string
}

export function handleInitialize(_params: InitializeParams) {
  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      documentHighlightProvider: true,
      completionProvider: {
        triggerCharacters: ['.', '/', '?'],
      },
      hoverProvider: true,
      inlayHintProvider: true,
      definitionProvider: true,
      referencesProvider: true,
      codeLensProvider: {
        resolveProvider: true,
      },
      renameProvider: {
        prepareProvider: false,
      },
      documentSymbolProvider: true,
      codeActionProvider: true,
      workspaceSymbolProvider: true,
      implementationProvider: true,
      semanticTokensProvider: {
        // NB: Must be in sync with ca.uwaterloo.flix.api.lsp.SemanticTokenType.
        legend: {
          tokenTypes: [
            'class',
            'enum',
            'enumMember',
            'function',
            'interface',
            'operator',
            'parameter',
            'property',
            'method',
            'namespace',
            'type',
            'typeParameter',
            'variable',
          ],
          tokenModifiers: ['declaration'],
        },
        full: true,
      },
    },
  }
  return result
}

export function handleReplaceConfiguration(userConfiguration: engine.UserConfiguration) {
  engine.updateUserConfiguration(userConfiguration)
}

/**
 * Simulates the language server disconnecting.
 * Used for testing.
 */
export function handleDisconnect() {
  engine.simulateDisconnect()
}

/**
 * Runs when both client and server are ready.
 */
export function handleReady(engineInput: engine.StartEngineInput) {
  engine.start(engineInput)
}

export function handleAddUri({ uri }: UriInput) {
  engine.addUri(uri)
}

export function handleRemUri({ uri }: UriInput) {
  engine.remUri(uri)
}

export function handleAddPkg({ uri }: UriInput) {
  engine.addPkg(uri)
}

export function handleRemPkg({ uri }: UriInput) {
  engine.remPkg(uri)
}

export function handleAddJar({ uri }: UriInput) {
  engine.addJar(uri)
}

export function handleRemJar({ uri }: UriInput) {
  engine.remJar(uri)
}

export const handleShowAst = enqueueUnlessHasErrors(
  makeShowAstJob,
  makeShowAstResponseHandler,
  hasErrorsHandlerForCommands,
)

function makeShowAstJob(params: any) {
  return {
    request: jobs.Request.lspShowAst,
    uri: params.uri,
    phase: params.phase,
  }
}

function makeShowAstResponseHandler(promiseResolver: () => void) {
  return function responseHandler({ status, result }: any) {
    sendNotification(jobs.Request.lspShowAst, { status, result })
    promiseResolver()
  }
}

export function handleExit() {
  engine.stop()
}

export function handleChangeContent(params: TextDocumentChangeEvent<TextDocument>) {
  const document = params.document
  engine.updateUri(document.uri, document.getText())
}

/**
 * @function
 */
export const handleGotoDefinition = makePositionalHandler(
  jobs.Request.lspGoto,
  undefined,
  makeGotoDefinitionResponseHandler,
)

function makeGotoDefinitionResponseHandler(promiseResolver: (result?: socket.FlixResult) => void) {
  return function responseHandler({ status, result }: socket.FlixResponse) {
    const targetUri = _.get('targetUri', result)
    if (status === StatusCode.Success) {
      if (_.startsWith('file://', targetUri)) {
        return promiseResolver(result)
      } else {
        sendNotification(jobs.Request.internalMessage, USER_MESSAGE.FILE_NOT_AVAILABLE(targetUri))
      }
    }
    promiseResolver()
  }
}

/**
 * @function
 */
export const handleImplementation = makePositionalHandler(jobs.Request.lspImplementation)

/**
 * @function
 */
export const handleHighlight = makePositionalHandler(jobs.Request.lspHighlight)

/**
 * @function
 */
export const handleComplete = makePositionalHandler(jobs.Request.lspComplete)

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

/**
 * @function
 */
export const handleRename = enqueueUnlessHasErrors(
  makeRenameJob,
  makeDefaultResponseHandler,
  hasErrorsHandlerForCommands,
)

function makeRenameJob(params: any) {
  return {
    request: jobs.Request.lspRename,
    uri: params.textDocument.uri,
    position: params.position,
    newName: params.newName,
  }
}

/**
 * @function
 */
export const handleDocumentSymbols = makePositionalHandler(jobs.Request.lspDocumentSymbols)

export function handleCodeAction(params: any): Promise<any> {
  const uri = params.textDocument ? params.textDocument.uri : undefined
  const range = params.range
  const context = params.context

  return new Promise(function (resolve) {
    const job = engine.enqueueJobWithFlattenedParams(jobs.Request.lspCodeAction, { uri, range, context })
    socket.eventEmitter.once(job.id, ({ status, result }) => resolve(result))
  })
}

/**
 * @function
 */
export const handleWorkspaceSymbols = enqueueUnlessHasErrors(
  makeWorkspaceSymbolsJob,
  makeDefaultResponseHandler,
  hasErrorsHandlerForCommands,
)

function makeWorkspaceSymbolsJob(params: any) {
  return {
    request: jobs.Request.lspWorkspaceSymbols,
    position: params.position,
    query: params.query || '',
  }
}

/**
 * @function
 */
export const handleSemanticTokens = makePositionalHandler(jobs.Request.lspSemanticTokens)

export const handleInlayHints = (params: InlayHintParams): Thenable<any> =>
  new Promise(resolve => {
    const job = engine.enqueueJobWithFlattenedParams(jobs.Request.lspInlayHints, {
      uri: params.textDocument.uri,
      range: params.range,
    })
    socket.eventEmitter.once(job.id, makeDefaultResponseHandler(resolve))
  })

function hasErrorsHandlerForCommands() {
  sendNotification(jobs.Request.internalError, {
    message: 'Cannot run commands when errors are present.',
    actions: [],
  })
  sendNotification(jobs.Request.internalFinishedJob)
}

/**
 * @function
 */
export const handleVersion = makeEnqueuePromise(jobs.Request.apiVersion, makeVersionResponseHandler)

function makeVersionResponseHandler(promiseResolver: () => void) {
  return function responseHandler({ status, result }: any) {
    // version is called on startup currently
    // use this to communicate back to the client that startup is done
    sendNotification(jobs.Request.internalReady)
    if (status === StatusCode.Success) {
      const message = USER_MESSAGE.CONNECTION_ESTABLISHED(result, engine)
      sendNotification(jobs.Request.internalMessage, message)
    } else {
      sendNotification(jobs.Request.internalError, {
        message: USER_MESSAGE.FAILED_TO_START(),
        actions: [],
      })
    }
    promiseResolver()
  }
}

/**
 * Handle response from lsp/check
 *
 * This is different from the rest of the response handlers in that it isn't tied together with its enqueueing function.
 */
export function lspCheckResponseHandler({ status, result }: socket.FlixResponse) {
  clearDiagnostics()
  sendNotification(jobs.Request.internalDiagnostics, { status, result })

  // TODO: Find out why TS doen't like this
  // @ts-ignore
  _.each(sendDiagnostics, result)
}

/**
 * Handle response where status is `statusCodes.COMPILER_ERROR`
 */
export function handleCrash({ status, result }: socket.FlixResponse) {
  const path = result?.reportPath as string
  sendNotification(jobs.Request.internalError, {
    message: USER_MESSAGE.COMPILER_CRASHED(path),
    actions: [
      {
        title: 'Open Report',
        command: {
          type: 'openFile',
          path,
        },
      },
    ],
  })
}
