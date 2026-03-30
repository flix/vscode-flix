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
 */
export function addUri(uri: string) {
  currentWorkspaceFiles.add(uri)

  const job: jobs.Job = {
    request: jobs.Request.apiAddUri,
    uri,
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

export function addPkg(uri: string) {
  const job: jobs.Job = {
    request: jobs.Request.apiAddPkg,
    uri,
  }
  queue.enqueue(job)
}

export function remPkg(uri: string) {
  const job: jobs.Job = {
    request: jobs.Request.apiRemPkg,
    uri,
  }
  queue.enqueue(job)
}

export function addJar(uri: string) {
  const job: jobs.Job = {
    request: jobs.Request.apiAddJar,
    uri,
  }
  queue.enqueue(job)
}

export function remJar(uri: string) {
  const job: jobs.Job = {
    request: jobs.Request.apiRemJar,
    uri,
  }
  queue.enqueue(job)
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
