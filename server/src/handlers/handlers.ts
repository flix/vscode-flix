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
import { makePositionalHandler, makeEnqueuePromise, enqueueUnlessHasErrors, makeDefaultResponseHandler } from './util'
import { getProjectRootUri } from '../engine'

const _ = require('lodash/fp')

interface UriInput {
  uri: string
}

function printHorizontalRuler () {
  console.log(_.repeat(48, String.fromCodePoint(0x23E4)))
}

export function handleInitialize (_params: InitializeParams) {
  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      documentHighlightProvider: true,
      hoverProvider: true,
      definitionProvider: true,
      referencesProvider: true,
      codeLensProvider: {
        resolveProvider: true
      },
      renameProvider: {
        prepareProvider: true
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
    const targetUri = _.get('targetUri', result)
    if (status === 'success') {
      if (_.startsWith('file://', targetUri)) {
        return promiseResolver(result)
      } else {
        sendNotification(jobs.Request.internalMessage, `Source for: '${targetUri}' is unavailable.`)
      }
    }
    promiseResolver()
  }
}

/**
 * @function
 */
export const handleHighlight = makePositionalHandler(jobs.Request.lspHighlight)

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
export const handlePrepareRename = enqueueUnlessHasErrors(makeRenameJob, makePrepareRenameResponseHandler, hasErrorsHandlerForCommands)

// changes have a weird data structure
const getFirstChange = _.flow(_.get('changes'), _.values, _.first, _.first)

function makePrepareRenameResponseHandler (promiseResolver: Function) {
  return function responseHandler ({ status, result }: socket.FlixResponse) {
    if (status === 'success') {
      const change = getFirstChange(result)
      promiseResolver({
        range: _.get('range', change),
        placeholder: _.get('newText', change)
      })
    } else {
      promiseResolver()
    }
  }
}

/**
 * @function
 */
export const handleRename = enqueueUnlessHasErrors(makeRenameJob, makeDefaultResponseHandler, hasErrorsHandlerForCommands)

function makeRenameJob (params: any) {
  return {
    request: jobs.Request.lspRename,
    uri: params.textDocument.uri,
    position: params.position,
    newName: params.newName || ''
  }
}

/**
 * @function
 */
export const handleRunBenchmarks = enqueueUnlessHasErrors({ request: jobs.Request.cmdRunBenchmarks }, makeRunBenchmarksResponseHandler, hasErrorsHandlerForCommands)

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
export const handleRunMain = enqueueUnlessHasErrors({ request: jobs.Request.cmdRunMain }, makeRunMainResponseHandler, hasErrorsHandlerForCommands)

function prettyPrintMainResult (result: any) {
  printHorizontalRuler()
  console.log(result)
}

function makeRunMainResponseHandler (promiseResolver: Function) {
  return function responseHandler (flixResponse: socket.FlixResponse) {
    const { status, result } = flixResponse
    prettyPrintMainResult(result)
    if (status === 'success') {
      promiseResolver(result)
    } else {
      sendNotification(jobs.Request.internalError, 'Could not run main')
      promiseResolver()
    }
    sendNotification(jobs.Request.internalFinishedJob, flixResponse)
  }
}

/**
 * @function
 */
export const handleRunTests = enqueueUnlessHasErrors({ request: jobs.Request.cmdRunTests }, makeRunTestsResponseHandler, hasErrorsHandlerForCommands)

function prettyPrintTestResults (result: any) {
  if (_.isEmpty(result)) {
    // nothing to print
    sendNotification(jobs.Request.internalMessage, 'No tests to run')
    return
  }
  printHorizontalRuler()
  for (const test of result) {
    console.log(
      test.outcome === 'success' 
        ? String.fromCodePoint(0x2705) 
        : String.fromCodePoint(0x274C),
      test.name,
      test.outcome === 'success' 
        ? '' 
        : `(at ${test.location.uri}#${test.location.range.start.line}:${test.location.range.start.character})`
    )
  }
  printHorizontalRuler()
  const totalTests = _.size(result)
  const successfulTests = _.size(_.filter({ outcome: 'success' }, result))
  const failingTests = totalTests - successfulTests
  if (failingTests > 0) {
    sendNotification(jobs.Request.internalError, `Tests Failed (${failingTests}/${totalTests})`)
  } else {
    sendNotification(jobs.Request.internalMessage, `Tests Passed (${successfulTests}/${totalTests})`)
  }
}

function makeRunTestsResponseHandler (promiseResolver: Function) {
  return function responseHandler (flixResponse: socket.FlixResponse) {
    // the status is always 'success' when with failing tests
    const { result } = flixResponse
    prettyPrintTestResults(result)
    promiseResolver(result)
    sendNotification(jobs.Request.internalFinishedJob, flixResponse)
  }
}

/**
 * @function
 */
export const makeHandleRunPackageCommand = (request: jobs.Request) => (
  enqueueUnlessHasErrors(() => ({ request, projectRootUri: getProjectRootUri() }), makeRunPackageCommandResponseHandler, hasErrorsHandlerForCommands)
)

function makeRunPackageCommandResponseHandler (promiseResolver: Function) {
  return function responseHandler ({ status, result }: socket.FlixResponse) {
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
  sendNotification(jobs.Request.internalFinishedJob)
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
      const message = `Flix ${major}.${minor}.${revision} Ready! (Extension: ${engine.getExtensionVersion()}) (Using ${engine.getFlixFilename()})`
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
  sendNotification(jobs.Request.internalDiagnostics, { status, result })
  if (status !== 'success') {
    _.each(sendDiagnostics, result)
  }
}
