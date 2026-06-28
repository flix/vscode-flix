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

import { InitializeParams, InitializeResult, TextDocumentSyncKind } from 'vscode-languageserver'

import * as jobs from '../engine/jobs'
import * as engine from '../engine'
import * as socket from '../engine/socket'

import { clearDiagnostics, sendDiagnostics, sendNotification } from '../server'
import { makeEnqueuePromise } from './util'
import { USER_MESSAGE } from '../util/userMessages'
import { StatusCode } from '../util/statusCodes'

export function handleInitialize(_params: InitializeParams) {
  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      documentHighlightProvider: true,
      completionProvider: {
        triggerCharacters: ['#', '.', '/', '?'],
      },
      hoverProvider: true,
      signatureHelpProvider: {
        triggerCharacters: ['(', ','],
      },
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
            'namespace',
            'type',
            'class',
            'enum',
            'interface',
            'struct',
            'typeParameter',
            'parameter',
            'variable',
            'property',
            'enumMember',
            'event',
            'function',
            'method',
            'macro',
            'keyword',
            'modifier',
            'comment',
            'string',
            'number',
            'regexp',
            'operator',
            'decorator',
            'effect',
          ],
          tokenModifiers: [
            'declaration',
            'definition',
            'readonly',
            'static',
            'deprecated',
            'abstract',
            'async',
            'modification',
            'documentation',
            'defaultLibrary',
          ],
        },
        full: true,
      },
      documentFormattingProvider: true,
      foldingRangeProvider: true,
    },
  }

  return result
}

/**
 * Runs when both client and server are ready.
 */
export function handleReady(engineInput: engine.StartEngineInput) {
  engine.start(engineInput)
}

export function handleExit() {
  engine.stop()
}

/**
 * Simulates the compiler disconnecting.
 * Used for testing.
 */
export function handleDisconnect() {
  const expectResponse = false
  socket.sendMessage({ id: 'disconnect', request: jobs.Request.apiDisconnect }, expectResponse)
}

/**
 * Request a response to be sent when all jobs are finished.
 */
export function handleFinishedAllJobs() {
  if (engine.unfinishedJobs() === 0) {
    // If already idle, send notification immediately
    sendNotification(jobs.Request.internalFinishedAllJobs)
  } else {
    socket.eventEmitter.on('any', function handler() {
      if (engine.unfinishedJobs() === 0) {
        sendNotification(jobs.Request.internalFinishedAllJobs)
        socket.eventEmitter.removeListener('any', handler)
      }
    })
  }
}

/**
 * @function
 */
export const handleVersion = makeEnqueuePromise({ request: jobs.Request.apiVersion }, makeVersionResponseHandler)

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
  result?.forEach(sendDiagnostics)
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
