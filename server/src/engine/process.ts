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
import { ChildProcess, spawn } from 'child_process'
import { getPortPromise } from 'portfinder'

import { UserConfiguration, StartEngineInput } from './config'
import { initWorkspaceFiles } from './workspace'
import * as jobs from './jobs'
import * as queue from './queue'
import * as socket from './socket'
import { USER_MESSAGE } from '../util/userMessages'

let flixInstance: ChildProcess | undefined = undefined
let startEngineInput: StartEngineInput
let flixRunning: boolean = false

export function isRunning() {
  return flixRunning
}

export function getFlixFilename() {
  return startEngineInput.flixFilename
}

export function getExtensionVersion() {
  return startEngineInput.extensionVersion ?? '(unknown version)'
}

export function updateUserConfiguration(userConfiguration: UserConfiguration) {
  if (startEngineInput !== undefined) {
    startEngineInput.userConfiguration = userConfiguration
  }
}

export async function start(input: StartEngineInput) {
  if (flixInstance || socket.isOpen()) {
    await stop()
  }

  // copy input to local var for later use
  startEngineInput = { ...input }

  const { flixFilename, extensionPath, workspaceFiles, workspacePkgs, workspaceJars } = input

  initWorkspaceFiles(workspaceFiles)

  // Check for valid Java version
  const { majorVersion, versionString } = await javaVersion(extensionPath)
  if (versionString === undefined) {
    // This happends when we are not able to run a java statement or get a java version
    sendNotification(jobs.Request.internalError, {
      message: USER_MESSAGE.JAVA_NOT_FOUND(),
      actions: [],
    })
    return
  }

  if (majorVersion! < 21) {
    sendNotification(jobs.Request.internalError, {
      message: USER_MESSAGE.JAVA_WRONG_VERSION(versionString),
      actions: [],
    })
    return
  }

  // get a port starting from 8888
  const port = await getPortPromise({ port: 8888 })

  // build the Java args from the user configuration
  // TODO split respecting ""
  const args = []
  args.push(...parseArgs(startEngineInput.userConfiguration.extraJvmArgs))
  args.push('-jar', flixFilename, 'lsp-vscode', `${port}`)
  args.push(...parseArgs(startEngineInput.userConfiguration.extraFlixArgs))

  //
  // WARNING: WE MUST CONNECT TO 127.0.0.1 AND NOT LOCALHOST.
  //
  // SEE https://github.com/microsoft/vscode/issues/192545
  //
  const instance = (flixInstance = spawn('java', args))
  const webSocketUrl = `ws://127.0.0.1:${port}`

  // forward flix to own stdout & stderr
  instance.stdout.pipe(process.stdout)
  instance.stderr.pipe(process.stderr)

  const connectToSocket = (data: any) => {
    const str = data
      .toString()
      .split(/(\r?\n)/g)
      .join('')
    if (str.includes(`:${port}`)) {
      // initialise websocket, listening to messages and what not
      socket.initialiseSocket({
        uri: webSocketUrl,
        onOpen: function handleOpen() {
          flixRunning = true
          const addUriJobs = workspaceFiles.map(uri => ({ uri, request: jobs.Request.apiAddUri }))
          const addPkgJobs = workspacePkgs.map(uri => ({ uri, request: jobs.Request.apiAddPkg }))
          const addJarJobs = workspaceJars.map(uri => ({ uri, request: jobs.Request.apiAddJar }))
          const Jobs: jobs.Job[] = [...addUriJobs, ...addPkgJobs, ...addJarJobs]
          queue.initialiseQueues(Jobs)
          handleVersion()
          sendNotification(jobs.Request.internalFinishedJob)
        },
        onClose: function handleClose() {
          flixRunning = false
        },
      })

      // now that the connection is established, there's no reason to listen for new messages
      instance.stdout.removeListener('data', connectToSocket)
    }
  }

  instance.stdout.addListener('data', connectToSocket)
}

/**
 * Parses the argument string into a list of arguments.
 */
function parseArgs(args: string): Array<string> {
  const trimmed = args.trim()
  if (trimmed === '') {
    return []
  } else {
    return args.split(' ')
  }
}

export async function stop() {
  queue.terminateQueue()
  await socket.closeSocket()
  if (flixInstance) {
    flixInstance.kill()
  }
}
