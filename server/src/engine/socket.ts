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

import * as jobs from './jobs'
import * as queue from './queue'
import { clearDiagnostics, sendNotification } from '../server'
import { EventEmitter } from 'events'
import { handleCrash, lspCheckResponseHandler } from '../handlers'
import { getPort } from 'portfinder'
import { USER_MESSAGE } from '../util/userMessages'
import { StatusCode } from '../util/statusCodes'

import * as WebSocket from 'ws'
import { DiagnosticSeverity, DiagnosticTag } from 'vscode-languageserver'

let webSocket: WebSocket | undefined = undefined
let webSocketOpen = false

// event emitter to handle communication between socket handlers and connection handlers
export const eventEmitter = new EventEmitter()

// keep track of messages sent so we can handle response timeouts
interface sentMessagesMap {
  [id: string]: NodeJS.Timeout
}
const sentMessagesMap: sentMessagesMap = {}
const MESSAGE_TIMEOUT_SECONDS = 30

export interface FlixResultCheck {
  uri: string
  diagnostics: [
    {
      range: {
        start: {
          line: number
          character: number
        }
        end: {
          line: number
          character: number
        }
      }
      severity: DiagnosticSeverity
      code: string
      message: string
      tags: DiagnosticTag[]
    },
  ]
}
export interface FlixResult {
  targetUri?: string
}

/**
 * The jobs that can be assumed to never produce an invalid request
 */
type InfallibleJobs = jobs.Request.lspCheck

interface FlixResponseBase {
  id: string
}
export interface FlixResponseCompilerError extends FlixResponseBase {
  jobRequest: jobs.Request
  status: StatusCode.CompilerError
  result: {
    reportPath: string
  }
}
/**
 * The special case of lsp/check, which is handled differently from the rest
 */
export interface FlixResponseCheck extends FlixResponseBase {
  jobRequest: jobs.Request.lspCheck
  status: StatusCode.Success
  result: FlixResultCheck[]
}
export interface FlixResponseSuccess extends FlixResponseBase {
  jobRequest: Exclude<jobs.Request, jobs.Request.lspCheck>
  status: StatusCode.Success
  result?: FlixResult
}
export interface FlixResponseInvalidRequest extends FlixResponseBase {
  jobRequest: Exclude<jobs.Request, InfallibleJobs>
  status: StatusCode.InvalidRequest
  message: string
}
type FlixResponseUnknown =
  | FlixResponseCompilerError
  | FlixResponseCheck
  | FlixResponseSuccess
  | FlixResponseInvalidRequest
/**
 * The types of responses observable by a normal job on the queue
 */
export type FlixResponse = FlixResponseSuccess | FlixResponseInvalidRequest

interface InitialiseSocketInput {
  uri: string
  onOpen?: () => void
  onClose?: () => void
}

export function isOpen() {
  return webSocket !== undefined && webSocketOpen
}

export function isClosed() {
  return !isOpen()
}

let lastManualStopTimestamp: number = 0

export function initialiseSocket({ uri, onOpen, onClose }: InitialiseSocketInput) {
  if (!uri) {
    throw 'Must be called with an uri'
  }
  webSocket = new WebSocket(uri)

  webSocket.on('open', () => {
    webSocketOpen = true
    onOpen && setTimeout(onOpen!, 0)
  })

  webSocket.on('close', () => {
    webSocketOpen = false
    if (lastManualStopTimestamp + 15000 < Date.now()) {
      // This happends when the connections breaks unintentionally
      console.log(USER_MESSAGE.CONNECTION_LOST())
      tryToConnect({ uri, onOpen, onClose }, 5).then(connected => {
        if (!connected) {
          console.log(USER_MESSAGE.CONNECTION_LOST_RESTARTING())
          sendNotification(jobs.Request.internalRestart)
        }
      })
      return
    }
    onClose && setTimeout(onClose!, 0)
  })

  webSocket.on('message', (data: string) => {
    const rawResponse: FlixResponseUnknown = JSON.parse(data)
    const job: jobs.EnqueuedJob = jobs.getJob(rawResponse.id)
    const flixResponse = { ...rawResponse, jobRequest: job.request } as FlixResponseUnknown

    handleResponse(flixResponse)
  })
}

async function tryToConnect({ uri, onOpen, onClose }: InitialiseSocketInput, times: number) {
  const uriPort = parseInt(uri.slice(-4))
  getPort({ port: uriPort }, (err, freePort) => {
    if (uriPort === freePort) {
      // This happens if the previously used port is now free
      sendNotification(jobs.Request.internalRestart)
      return
    }
  })
  let retries = times
  while (retries-- > 0) {
    initialiseSocket({ uri, onOpen, onClose })
    await sleep(1000)
    if (webSocketOpen) {
      return true
    }
  }
  return false
}

function clearTimer(id: string) {
  clearTimeout(sentMessagesMap[id])
  delete sentMessagesMap[id]
}

function clearAllTimers() {
  Object.keys(sentMessagesMap).forEach(clearTimer)
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function closeSocket() {
  let retries = 0
  if (webSocket) {
    clearAllTimers()
    lastManualStopTimestamp = Date.now()
    webSocket.close()

    while (retries++ < 50) {
      if (webSocket.readyState === 3) {
        webSocketOpen = false
        return
      }
      await sleep(100)
    }
  } else {
    webSocketOpen = false
  }
}

export function sendMessage(job: jobs.EnqueuedJob, retries = 0) {
  if (isClosed()) {
    if (retries > 2) {
      const errorMessage = USER_MESSAGE.REQUEST_TIMEOUT(retries)
      return sendNotification(jobs.Request.internalError, {
        message: errorMessage,
        actions: [],
      })
    }
    setTimeout(() => {
      sendMessage(job, retries + 1)
    }, 1000)
    return
  }
  // register a timer to handle timeouts
  sentMessagesMap[job.id] = setTimeout(() => {
    delete sentMessagesMap[job.id]
    sendNotification(jobs.Request.internalError, {
      message: USER_MESSAGE.RESPONSE_TIMEOUT(MESSAGE_TIMEOUT_SECONDS),
      actions: [],
    })
    setTimeout(queue.processQueue, 0)
  }, MESSAGE_TIMEOUT_SECONDS * 1000)
  // send job as string
  webSocket?.send(JSON.stringify(job))
}

function handleResponse(flixResponse: FlixResponseUnknown) {
  if (flixResponse.status === StatusCode.CompilerError) {
    clearDiagnostics()
    handleCrash(flixResponse)
  } else if (flixResponse.jobRequest === jobs.Request.lspCheck) {
    lspCheckResponseHandler(flixResponse)
  } else {
    eventEmitter.emit(flixResponse.id, flixResponse)
  }
  // clear timer because we received a response
  clearTimer(flixResponse.id)
  // ask queue to process next item
  setTimeout(queue.processQueue, 0)
}
