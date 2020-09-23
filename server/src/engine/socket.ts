import * as jobs from './jobs'
import * as queue from './queue'
import { clearDiagnostics, sendDiagnostics, sendNotification } from '../server'
import { EventEmitter } from 'events'

const _ = require('lodash/fp')
const WebSocket = require('ws')

let webSocket: any
let webSocketOpen = false
let queueProcessingTimer: NodeJS.Timeout

// event emitter to handle communication between socket handlers and connection handlers
export const eventEmitter = new EventEmitter()

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

interface FlixResponse {
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
    queueProcessingTimer = setInterval(queue.processQueue, 2000)
  })

  webSocket.on('close', () => {
    webSocketOpen = false
    onClose && setTimeout(onClose!, 0)
    clearInterval(queueProcessingTimer)
  })

  webSocket.on('message', (data: string) => {
    const flixResponse: FlixResponse = JSON.parse(data)
    const job: jobs.EnqueuedJob = jobs.getJob(flixResponse.id)

    handleResponse(flixResponse, job)

    setTimeout(queue.processQueue, 0)
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
      return console.error('Could not validate - websocket not available')
    }
    setTimeout(() => {
      sendMessage(job, retries + 1)
    }, 1000)
    return
  }
  webSocket.send(JSON.stringify(job))
}

function handleResponse (flixResponse: FlixResponse, job: jobs.EnqueuedJob) {
  switch (job.request) {
    case jobs.Request.lspCheck:
      return handleCheck(flixResponse)
    case jobs.Request.lspHover:
    case jobs.Request.lspGoto:
    case jobs.Request.lspUses:
    case jobs.Request.lspCodelens:
    case jobs.Request.apiShutdown:
      return handleGenericRoundtripResponse(flixResponse)
    case jobs.Request.apiVersion:
      return handleVersion(flixResponse)
    default:
      return
  }
}

function handleCheck (flixResponse: FlixResponse) {
  clearDiagnostics()
  if (flixResponse.status !== 'success') {
    _.each(sendDiagnostics, flixResponse.result)
  }
}

function handleGenericRoundtripResponse (flixResponse: FlixResponse) {
  eventEmitter.emit(flixResponse.id, flixResponse)
}

/**
 * This is only called on startup.
 */
function handleVersion ({ status, result }: any) {
  if (status !== 'success') {
    sendNotification(jobs.Request.internalError, 'Failed starting Flix')
  } else {
    const { major, minor, revision } = result
    const message = `Started Flix (${major}.${minor}-rev${revision})`
    sendNotification(jobs.Request.internalMessage, message)
  }
}
