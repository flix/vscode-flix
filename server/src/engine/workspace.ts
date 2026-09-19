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

let currentWorkspaceFiles: Set<string> = new Set()

export function initWorkspaceFiles(files: string[]) {
  currentWorkspaceFiles = new Set(files)
}

/**
 * Add the given `uri` to the workspace.
 *
 * If `src` is given, it is used as the content of the file, which therefore does not have to exist
 * on disk. Otherwise the content is read from disk when the job is processed.
 */
export function addUri(uri: string, src?: string) {
  currentWorkspaceFiles.add(uri)

  const job: jobs.Job = {
    request: jobs.Request.apiAddUri,
    uri,
    src,
  }
  queue.enqueue(job)
}

/**
 * Handle a change in the file with the given `uri`.
 *
 * If this URI has not already been added to the workspace via {@linkcode addUri},
 * it will be ignored, making it safe to call this function on any file.
 */
export function updateUri(uri: string, src: string) {
  if (!currentWorkspaceFiles.has(uri)) {
    return
  }

  // Including the source code in the job is necessary because the file might not yet have been saved
  const job: jobs.Job = {
    request: jobs.Request.apiAddUri,
    uri,
    src,
  }

  queue.enqueue(job)
}

/**
 * Remove the given `uri` from the workspace.
 */
export function remUri(uri: string) {
  currentWorkspaceFiles.delete(uri)

  const job: jobs.Job = {
    request: jobs.Request.apiRemUri,
    uri,
  }
  queue.enqueue(job)
}

/**
 * How long a restart holds off the next one.
 */
const RESTART_THROTTLE_MS = 300

let restartTimer: ReturnType<typeof setTimeout> | undefined
let restartRequested = false

/**
 * Load the project again and start over with a fresh compiler.
 *
 * The packages and JARs of a project are the ones its `flix.toml` declares, and they are fixed for
 * the lifetime of a compiler instance. A change to one of them is therefore applied by loading the
 * project again rather than by handing the individual file to the compiler.
 *
 * Loading a project resolves its dependencies, so the restarts are throttled: the first one is sent
 * at once, and the ones which follow within the window are folded into a single restart sent when
 * the window closes. A build which rewrites several packages therefore loads the project a handful
 * of times rather than once per package, and nothing which arrived late is missed.
 *
 * The check comes last, when a window closes with nothing left to load, so that a burst is checked
 * once, against the project it ends up with.
 */
export function restart() {
  if (restartTimer !== undefined) {
    // Within the window of an earlier restart: fold into the one sent when it closes.
    restartRequested = true
    return
  }
  queue.enqueue({ request: jobs.Request.apiRestart })
  openRestartTimerWindow()
}

/**
 * Holds off the next restart until the window closes, and checks the project once they have settled.
 */
function openRestartTimerWindow() {
  restartTimer = setTimeout(() => {
    restartTimer = undefined
    if (restartRequested) {
      restartRequested = false
      queue.enqueue({ request: jobs.Request.apiRestart })
      openRestartTimerWindow()
    } else {
      queue.enqueue({ request: jobs.Request.lspCheck })
    }
  }, RESTART_THROTTLE_MS)
}

/**
 * Forgets a restart which has not been sent yet, so that it does not outlive the compiler it was
 * meant for.
 */
export function cancelPendingRestart() {
  if (restartTimer !== undefined) {
    clearTimeout(restartTimer)
    restartTimer = undefined
  }
  restartRequested = false
}

export function enqueueJobWithFlattenedParams(request: jobs.Request, params?: any) {
  const job: jobs.Job = {
    request,
    ...(params || {}),
  }
  return queue.enqueue(job)
}

export function unfinishedJobs() {
  return queue.unfinishedJobs()
}
