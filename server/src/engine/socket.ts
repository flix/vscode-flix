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
import { sendNotification } from '../server'
import { EventEmitter } from 'events'
import { lspCheckResponseHandler } from '../handlers'

const _ = require('lodash/fp')
const WebSocket = require('ws')

let webSocket: any
let webSocketOpen = false

// event emitter to handle communication between socket handlers and connection handlers
export const eventEmitter = new EventEmitter()

// keep track of messages sent so we can handle response timeouts
interface sentMessagesMap {
  [id: string]: NodeJS.Timeout
}
const sentMessagesMap: sentMessagesMap = {}
const MESSAGE_TIMEOUT_SECONDS = 30

interface FlixResult {
  uri: string
  diagnostics: [{
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
    severity: number
    code: string
    message: string
    tags: string[]
  }]
}

export interface FlixResponse {
  id: string
  status: string
  result?: FlixResult
}

interface InitialiseSocketInput {
  uri: string,
  onOpen?: () => void,
  onClose?: () => void
}

export function isOpen () {
  return webSocket && webSocketOpen
}

export function isClosed () {
  return !isOpen()
}

export function initialiseSocket ({ uri, onOpen, onClose }: InitialiseSocketInput) {
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
    onClose && setTimeout(onClose!, 0)
  })

  webSocket.on('message', (data: string) => {
    const flixResponse: FlixResponse = JSON.parse(data)
    const job: jobs.EnqueuedJob = jobs.getJob(flixResponse.id)

    handleResponse(flixResponse, job)
  })
}

export function closeSocket () {
  if (webSocket) {
    webSocket.close()
  } else {
    webSocketOpen = false
  }
}

export function sendMessage (job: jobs.EnqueuedJob, retries = 0) {
  if (isClosed()) {
    if (retries > 2) {
      const errorMessage = `Could not send message after ${retries} retries. Websocket not available.`
      return sendNotification(jobs.Request.internalError, errorMessage)
    }
    setTimeout(() => {
      sendMessage(job, retries + 1)
    }, 1000)
    return
  }
  // register a timer to handle timeouts
  sentMessagesMap[job.id] = setTimeout(() => {
    sendNotification(jobs.Request.internalError, `Job timed out after ${MESSAGE_TIMEOUT_SECONDS} seconds`)
    setTimeout(queue.processQueue, 0)
  }, (MESSAGE_TIMEOUT_SECONDS * 1000))
  // send job as string
  webSocket.send(JSON.stringify(job))
}

function handleResponse (flixResponse: FlixResponse, job: jobs.EnqueuedJob) {
  if (job.request === jobs.Request.lspCheck) {
    lspCheckResponseHandler(flixResponse)
  } else {
    eventEmitter.emit(flixResponse.id, flixResponse)
  }
  // clear timer because we received a response
  clearTimeout(sentMessagesMap[flixResponse.id])
  // ask queue to process next item
  setTimeout(queue.processQueue, 0)
}
