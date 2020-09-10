import { jobs } from './jobs'

const WebSocket = require('ws')

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
    const idString = `${id}`
    if (status !== 'success') {
      console.error('Should handle status !== success')
      return
    }
    const job = jobs[idString]
    if (job.request === 'api/addUri') {
      const id = '2'
      const message = {
        request: 'lsp/check',
        id
      }
      jobs[id] = message
      console.log(JSON.stringify(message))
      webSocket.send(JSON.stringify(message))
    }
    if (job.request === 'lsp/check') {
      console.log('returning from check', job)
    }
  })
}

export function closeSocket () {
  if (webSocket) {
    webSocket.close()
  } else {
    webSocketOpen = false
  }
}

export function sendMessage (message: SendMessageInput, retries = 0) {
  if (isClosed()) {
    if (retries > 2) {
      return console.error('Could not validate - websocket not available')
    }
    setTimeout(() => {
      sendMessage(message, retries + 1)
    }, 1000)
    return
  }
  console.log(JSON.stringify(message))
  webSocket.send(JSON.stringify(message))
}
