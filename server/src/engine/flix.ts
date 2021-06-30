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

export interface CompileOnSave {
  enabled: boolean
}

export interface CompileOnChange {
  enabled: boolean,
  delay: number
}

export interface UserConfiguration {
  compileOnSave: CompileOnSave,
  compileOnChange: CompileOnChange
}

export interface StartEngineInput {
  flixFilename: string,
  workspaceFolders: [string],
  extensionPath: string,
  extensionVersion: string,
  globalStoragePath: string,
  workspaceFiles: [string],
  workspacePkgs: [string],
  userConfiguration: UserConfiguration
}

let flixInstance: any
let startEngineInput: StartEngineInput
let flixRunning: boolean = false

export function isRunning () {
  return flixRunning
}

export function getFlixFilename () {
  return startEngineInput.flixFilename
}

export function getExtensionVersion () {
  return _.getOr('(unknown version)', 'extensionVersion', startEngineInput)
}

export function getProjectRootUri () {
  return _.first(startEngineInput.workspaceFolders)
}

export function updateUserConfiguration (userConfiguration: UserConfiguration) {
  startEngineInput = _.set('userConfiguration', userConfiguration, startEngineInput)
  queue.resetEnqueueDebounced()
}

export function compileOnSaveEnabled () {
  return startEngineInput?.userConfiguration.compileOnSave.enabled ?? true
}

export function compileOnChangeEnabled () {
  return startEngineInput?.userConfiguration.compileOnChange.enabled ?? true
}

export function compileOnChangeDelay () {
  return startEngineInput?.userConfiguration.compileOnChange.delay ?? 300
}

export async function start (input: StartEngineInput) {
  if (flixInstance || socket.isOpen()) {
    stop()
  }

  // copy input to local var for later use
  startEngineInput = _.clone(input)

  const { flixFilename, extensionPath, workspaceFiles, workspacePkgs } = input

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

  // forward flix to own stdout & stderr
  flixInstance.stdout.pipe(process.stdout)
  flixInstance.stderr.pipe(process.stderr)

  const connectToSocket = (data: any) => {
    const str = data.toString().split(/(\r?\n)/g).join('')
    if (str.includes(`:${port}`)) {
      // initialise websocket, listening to messages and what not
      socket.initialiseSocket({
        uri: webSocketUrl,
        onOpen: function handleOpen () {
          flixRunning = true
          let addUriJobs = _.map((uri: string) => ({ uri, request: jobs.Request.apiAddUri }), workspaceFiles)
          let addPkgJobs = _.map((uri: string) => ({ uri, request: jobs.Request.apiAddPkg }), workspacePkgs)
          let Jobs:any = []
          Jobs.push(...addUriJobs)
          Jobs.push(...addPkgJobs)
          queue.initialiseQueues(Jobs)
          handleVersion()
        },
        onClose: function handleClose () {
          flixRunning = false
        }
      })

      // now that the connection is established, there's no reason to listen for new messages
      flixInstance.stdout.removeListener('data', connectToSocket)
    }
  }

  flixInstance.stdout.on('data', connectToSocket)
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

export function addPkg (uri: string) {
  const job: jobs.Job = {
    request: jobs.Request.apiAddPkg,
    uri
  }
  queue.enqueue(job)
}
  
export function remPkg (uri: string) {
  const job: jobs.Job = {
    request: jobs.Request.apiRemPkg,
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
