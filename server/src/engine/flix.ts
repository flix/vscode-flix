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

import { handleVersion } from '../handlers'
import { sendNotification } from '../server'
import javaVersion from '../util/javaVersion'

import * as jobs from './jobs'
import * as queue from './queue'
import * as socket from './socket'

const _ = require('lodash/fp')
const ChildProcess = require('child_process')
const portfinder = require('portfinder')

export interface StartEngineInput {
  flixFilename: string,
  workspaceFolders: [string],
  extensionPath: string,
  extensionVersion: string,
  globalStoragePath: string,
  workspaceFiles: [string]
}

let flixInstance: any
let startEngineInput: StartEngineInput

export function getFlixFilename () {
  return startEngineInput.flixFilename
}

export function getExtensionVersion () {
  return _.getOr('(unknown version)', 'extensionVersion', startEngineInput)
}

export function getProjectRootUri () {
  return _.first(startEngineInput.workspaceFolders)
}

export async function start (input: StartEngineInput) {
  if (flixInstance || socket.isOpen()) {
    stop()
  }

  // copy input to local var for later use
  startEngineInput = _.clone(input)

  const { flixFilename, extensionPath, workspaceFiles } = input

  // Check for valid Java version
  const { majorVersion, versionString } = await javaVersion(extensionPath)
  if (majorVersion < 11) {
    sendNotification(jobs.Request.internalError, `Flix requires Java 11 or later. Found "${versionString}".`)
    return
  }

  // get a port starting from 8888
  const port = await portfinder.getPortPromise({ port: 8888 })

  flixInstance = ChildProcess.spawn('java', ['-jar', flixFilename, '--lsp', port])
  const webSocketUrl = `ws://localhost:${port}`

  flixInstance.stdout.on('data', (data: any) => {
    const str = data.toString().split(/(\r?\n)/g).join('')

    if (str.includes(`:${port}`)) {
      // initialise websocket, listening to messages and what not
      socket.initialiseSocket({
        uri: webSocketUrl,
        onOpen: function handleOpen () {
          queue.initialiseQueues(_.map((uri: string) => ({ uri, request: jobs.Request.apiAddUri }), workspaceFiles))
          handleVersion()
        }
      })

      // now that the connection is established, there's no reason to listen for new messages
      flixInstance.stdout.removeAllListeners('data')
    }
  })

  flixInstance.stderr.on('data', (data: any) => {
    // Text on missing/inaccessible: 'Error: Unable to access jarfile'
    // Port in use: 'java.net.BindException: Address already in use: bind'
    const errorAsString = data.toString().split(/(\r?\n)/g).join('')
    const errorMessage = `Flix LSP responded with an error. \n${errorAsString}`
    sendNotification(jobs.Request.internalError, errorMessage)
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
}

export function remUri (uri: string) {
  const job: jobs.Job = {
    request: jobs.Request.apiRemUri,
    uri
  }
  queue.enqueue(job)
}

export function enqueueJobWithPosition (request: jobs.Request, params?: any) {
  const job: jobs.Job = {
    request,
    ...(params || {})
  }
  return queue.enqueue(job)
}
