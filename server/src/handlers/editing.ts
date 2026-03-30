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

import { DocumentFormattingParams, TextEdit } from 'vscode-languageserver'

import * as jobs from '../engine/jobs'
import * as engine from '../engine'
import * as socket from '../engine/socket'

import { makePositionalHandler, makeEnqueuePromise, makeDefaultResponseHandler } from './util'

/**
 * @function
 */
export const handleComplete = makePositionalHandler(jobs.Request.lspComplete)

/**
 * @function
 */
export const handleHover = makePositionalHandler(jobs.Request.lspHover)

export const handleSignature = makePositionalHandler(jobs.Request.lspSignature)

/**
 * @function
 */
export const handleRename = makeEnqueuePromise(makeRenameJob, makeDefaultResponseHandler) as (
  params: any,
) => Promise<any>

function makeRenameJob(params: any) {
  return {
    request: jobs.Request.lspRename,
    uri: params.textDocument.uri,
    position: params.position,
    newName: params.newName,
  }
}

/**
 * Handle document formatting requests.
 *
 * @param params - The document formatting parameters.
 * @returns A promise that resolves to an array of text edits.
 */
export const handleDocumentFormatting = (params: DocumentFormattingParams): Promise<TextEdit[]> => {
  const uri = params.textDocument?.uri
  const options = params.options

  return new Promise<TextEdit[]>(function (resolve) {
    const job = engine.enqueueJobWithFlattenedParams(jobs.Request.lspFormatting, { uri, options })
    socket.eventEmitter.once(job.id, ({ result }: socket.FlixResponse) => {
      resolve((result ?? []) as unknown as TextEdit[])
    })
  })
}
