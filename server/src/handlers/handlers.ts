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
import { TextDocument } from 'vscode-languageserver-textdocument'

import * as jobs from '../engine/jobs'
import * as queue from '../engine/queue'
import * as engine from '../engine'
import * as socket from '../engine/socket'

import { clearDiagnostics, sendDiagnostics, sendNotification } from '../server'
import { makePositionalHandler, makeEnqueuePromise, enqueueUnlessHasErrors } from './util'

const _ = require('lodash/fp')

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

export function handleChangeContent (params: any) {
  const document: TextDocument = params.document
  const job: jobs.Job = {
    request: jobs.Request.apiAddUri,
    uri: document.uri, // Note: this typically has the file:// scheme (important for files as keys)
    src: document.getText()
  }
  queue.enqueue(job)
}

/**
 * @function
 */
export const handleGotoDefinition = makePositionalHandler(jobs.Request.lspGoto, undefined, makeGotoDefinitionResponseHandler)

function makeGotoDefinitionResponseHandler (promiseResolver: Function) {
  return function responseHandler ({ status, result }: socket.FlixResponse) {
    if (status === 'success') {
      if (_.startsWith('file://', _.get('targetUri', result))) {
        return promiseResolver(result)
      } else {
        sendNotification(jobs.Request.internalMessage, 'Cannot go to definition for Flix Standard Library')
      }
    }
    promiseResolver()
  }
}

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
export const handleRunBenchmarks = enqueueUnlessHasErrors(jobs.Request.cmdRunBenchmarks, makeRunBenchmarksResponseHandler, hasErrorsHandlerForCommands)

function makeRunBenchmarksResponseHandler (promiseResolver: Function) {
  return function responseHandler ({ status, result }: socket.FlixResponse) {
    if (status === 'success') {
      sendNotification(jobs.Request.internalMessage, 'Benchmarks ran successfully')
      promiseResolver(result)
    } else {
      sendNotification(jobs.Request.internalError, 'Benchmarks failed to run')
      promiseResolver()
    }
  }
}

/**
 * @function
 */
export const handleRunMain = enqueueUnlessHasErrors(jobs.Request.cmdRunMain, makeRunMainResponseHandler, hasErrorsHandlerForCommands)

function makeRunMainResponseHandler (promiseResolver: Function) {
  return function responseHandler ({ status, result }: socket.FlixResponse) {
    if (status === 'success') {
      sendNotification(jobs.Request.internalMessage, `Flix output:\n${result}`)
      promiseResolver(result)
    } else {
      sendNotification(jobs.Request.internalError, `Flix output:\n${result}`)
      promiseResolver()
    }
  }
}

/**
 * @function
 */
export const handleRunTests = enqueueUnlessHasErrors(jobs.Request.cmdRunTests, makeRunTestsResponseHandler, hasErrorsHandlerForCommands)

function makeRunTestsResponseHandler (promiseResolver: Function) {
  return function responseHandler ({ status, result }: socket.FlixResponse) {
    if (status === 'success') {
      sendNotification(jobs.Request.internalMessage, 'All tests ran successfully')
      promiseResolver(result)
    } else {
      sendNotification(jobs.Request.internalError, 'Test(s) failed')
      promiseResolver()
    }
  }
}


/**
 * @function
 */
export const makeHandleRunPackageCommand = (request: jobs.Request) => (
  enqueueUnlessHasErrors(request, makeRunPackageCommandResponseHandler, hasErrorsHandlerForCommands)
)

function makeRunPackageCommandResponseHandler (promiseResolver: Function) {
  console.warn('123')
  return function responseHandler ({ status, result }: socket.FlixResponse) {
    console.warn('456')
    if (status === 'success') {
      sendNotification(jobs.Request.internalMessage, `Package command result: \n${result}`)
      promiseResolver(result)
    } else {
      sendNotification(jobs.Request.internalError, 'Package command failed')
      promiseResolver()
    }
  }
}

function hasErrorsHandlerForCommands () {
  sendNotification(jobs.Request.internalError, 'Cannot run commands when errors are present.')
}

/**
 * @function
 */
export const handleVersion = makeEnqueuePromise(jobs.Request.apiVersion, makeVersionResponseHandler)

function makeVersionResponseHandler (promiseResolver: Function) {
  return function responseHandler ({ status, result }: any) {
    // version is called on startup currently
    // use this to communicate back to the client that startup is done
    sendNotification(jobs.Request.internalReady)
    if (status === 'success') {
      const { major, minor, revision } = result
      const message = `Flix Extension ${engine.getExtensionVersion()} ready! Running Flix ${major}.${minor}-rev${revision}\n(${engine.getFlixFilename()})`
      sendNotification(jobs.Request.internalMessage, message)
    } else {
      sendNotification(jobs.Request.internalError, 'Failed starting Flix')
    }
    promiseResolver()
  }
}

/**
 * Handle response from lsp/check
 * 
 * This is different from the rest of the response handlers in that it isn't tied together with its enqueueing function.
 */
export function lspCheckResponseHandler ({ status, result }: socket.FlixResponse) {
  clearDiagnostics()
  if (status !== 'success') {
    _.each(sendDiagnostics, result)
  }
}
