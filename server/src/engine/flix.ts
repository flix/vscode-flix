import { sendNotification } from '../server'
import downloadFlix from '../util/downloadFlix'

import * as jobs from './jobs'
import * as queue from './queue'
import * as socket from './socket'

const _ = require('lodash/fp')
const path = require('path')
const ChildProcess = require('child_process')

let flixInstance: any
let port = 8888

export interface StartEngineInput {
  extensionPath: string,
  globalStoragePath: string,
  workspaceFiles: [string]
}

export async function start ({ globalStoragePath, workspaceFiles }: StartEngineInput) {
  if (flixInstance || socket.isOpen()) {
    stop()
  }

  function handleOpen () {
    queue.enqueueMany(_.map((uri: string) => ({ uri, request: jobs.Request.apiAddUri }), workspaceFiles))
  }

  try {
    await downloadFlix(globalStoragePath, /* true (skip download) */)
  } catch (err) {
    throw 'Could not download flix - refusing to start'
  }

  flixInstance = ChildProcess.spawn('java', ['-jar', path.join(globalStoragePath, 'flix.jar'), '--lsp', port])
  const webSocketUrl = `ws://localhost:${port}`

  flixInstance.stdout.on('data', (data: any) => {
    const str = data.toString().split(/(\r?\n)/g).join('')

    console.warn('[debug]', str) // we keep this because some error messages are erroneously sent this way

    if(str.includes(`:${port}`)) {
      // initialise websocket, listening to messages and what not
      socket.initialiseSocket({ 
        uri: webSocketUrl,
        onOpen: handleOpen
      })

      // now that the connection is established, there's no reason to listen for new messages
      // flixInstance.stdout.removeAllListeners('data')  -- TODO: Remove comment when LSP has been updated
    }
  })

  flixInstance.stderr.on('data', (data: any) => {
    // Text on missing/inaccessible: 'Error: Unable to access jarfile'
    const str = data.toString().split(/(\r?\n)/g).join('')
    console.error('[error]', str)
    console.log('[debug] Attempt to restart')
    sendNotification(jobs.Request.internalRestart)
  })
}

export function stop () {
  if (flixInstance) {
    flixInstance.kill()
  }
  socket.closeSocket()
}

export function addUri (uri: string) {
  const job: jobs.Job = {
    request: jobs.Request.apiAddUri,
    uri
  }
  queue.enqueue(job)
  queue.enqueue(jobs.createCheck())
}

export function remUri (uri: string) {
  const job: jobs.Job = {
    request: jobs.Request.apiRemUri,
    uri
  }
  queue.enqueue(job)
  queue.enqueue(jobs.createCheck())
}

export function enqueueJobWithPosition (request: jobs.Request, uri: string, position: jobs.Position) {
  const job: jobs.Job = {
    request,
    uri,
    position: {
      line: position.line + 1,
      character: position.character + 1
    }
  }
  return queue.enqueue(job)
}
