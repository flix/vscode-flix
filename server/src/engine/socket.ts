import * as jobs from './jobs'

const WebSocket = require('ws')
const fs = require('fs')

let webSocket: any
let webSocketOpen = false

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

interface SendMessageInput {

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
    const { id, status }: FlixResponse = JSON.parse(data)
    const job: jobs.EnqueuedJob = jobs.getJob(id)

    console.warn('[debug]', id, status, job)

    if (status !== 'success') {
      console.error('Failed job', job)
    } else {

      if (job.request === 'api/addUri') {
        console.warn('[debug] Added uri', job)
      }

    }

    setTimeout(processQueue, 0)
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
  console.warn('sendMessage', JSON.stringify(job))
  webSocket.send(JSON.stringify(job))
}

let queueRunning = false

export function startQueue () {
  console.warn('[debug] startQueue', queueRunning)
  if (queueRunning) {
    return
  }
  queueRunning = true
  processQueue()
}

async function processQueue () {
  console.warn('[debug] processQueue')
  const job: jobs.EnqueuedJob = jobs.dequeue()
  if (job) {
    try {
      if (job.request === 'api/addUri' && !job.src) {
        const src = fs.readFileSync(job.uri, 'utf8')
        sendMessage({ ...job, src })
      } else {
        sendMessage(job)
      }
    } catch (err) {
      console.error('Could not read file in queue', job)
    }
  } else {
    console.warn('[debug] Queue empty')
    queueRunning = false
  }
}
