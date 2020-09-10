import * as jobs from './jobs'

const WebSocket = require('ws')
const fs = require('fs')

let webSocket: any
let webSocketOpen = false

interface FlixResponse {
  id: string
  status: string
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

export async function processQueue () {
  console.warn('[debug] processQueue')
  const job: jobs.EnqueuedJob = jobs.dequeue()
  if (job) {
    try {
      const src = fs.readFileSync(job.uri, 'utf8')
      sendMessage({ ...job, src })
    } catch (err) {
      console.error('Could not read file in queue', job)
    }
  } else {
    console.warn('[debug] Queue empty')
  }
}
