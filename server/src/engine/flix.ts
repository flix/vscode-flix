import { handleVersion } from '../handlers'
import { sendNotification } from '../server'
import downloadFlix from '../util/downloadFlix'
import javaVersion from '../util/javaVersion'

import * as jobs from './jobs'
import * as queue from './queue'
import * as socket from './socket'

const _ = require('lodash/fp')
const ChildProcess = require('child_process')

let flixInstance: any
let port = 8888

interface LaunchOptions {
  shouldUpdateFlix: boolean
}

export interface StartEngineInput {
  workspaceFolders: [string],
  extensionPath: string,
  globalStoragePath: string,
  workspaceFiles: [string],
  launchOptions?: LaunchOptions
}

export async function start ({ workspaceFolders, extensionPath, globalStoragePath, workspaceFiles, launchOptions }: StartEngineInput) {
  if (flixInstance || socket.isOpen()) {
    stop()
  }

  // Check for valid Java version
  const { majorVersion, versionString } = await javaVersion(extensionPath)
  if (majorVersion < 11) {
    sendNotification(jobs.Request.internalError, `Flix requires Java 11 or later. Found "${versionString}".`)
    return
  }

  const shouldUpdateFlix = launchOptions && launchOptions.shouldUpdateFlix
  const { filename } = await downloadFlix({ workspaceFolders, globalStoragePath, shouldUpdateFlix })

  flixInstance = ChildProcess.spawn('java', ['-jar', filename, '--lsp', port])
  const webSocketUrl = `ws://localhost:${port}`

  flixInstance.stdout.on('data', (data: any) => {
    const str = data.toString().split(/(\r?\n)/g).join('')

    console.warn('[debug]', str) // we keep this because some error messages are erroneously sent this way

    if(str.includes(`:${port}`)) {
      // initialise websocket, listening to messages and what not
      socket.initialiseSocket({ 
        uri: webSocketUrl,
        onOpen: function handleOpen () {
          queue.enqueueMany(_.map((uri: string) => ({ uri, request: jobs.Request.apiAddUri }), workspaceFiles))
          handleVersion()
        }
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
  queue.terminateQueue()
  socket.closeSocket()
  if (flixInstance) {
    flixInstance.kill()
  }
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

export function enqueueJobWithPosition (request: jobs.Request, uri?: string, position?: jobs.Position) {
  const job: jobs.Job = {
    request,
    uri,
    position
  }
  return queue.enqueue(job)
}
