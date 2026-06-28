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

import { FoldingRange, FoldingRangeParams } from 'vscode-languageserver'

import * as jobs from '../engine/jobs'
import * as engine from '../engine'
import * as socket from '../engine/socket'

import { makePositionalHandler, makeEnqueuePromise, makeDefaultResponseHandler } from './util'

/**
 * @function
 */
export const handleDocumentSymbols = makePositionalHandler(jobs.Request.lspDocumentSymbols)

/**
 * Handle folding range requests.
 *
 * @param params - The folding range parameters.
 * @returns A promise that resolves to an array of folding ranges.
 */
export const handleFoldingRanges = (params: FoldingRangeParams): Promise<FoldingRange[]> =>
  new Promise(function (resolve) {
    const uri = params.textDocument?.uri
    const job = engine.enqueueJobWithFlattenedParams(jobs.Request.lspFoldingRange, { uri })
    socket.eventEmitter.once(job.id, ({ result }: socket.FlixResponse) => {
      resolve((result ?? []) as unknown as FoldingRange[])
    })
  })

/**
 * @function
 */
export const handleCodelens = makePositionalHandler(jobs.Request.lspCodelens)

export function handleCodeAction(params: any): Promise<any> {
  const uri = params.textDocument ? params.textDocument.uri : undefined
  const range = params.range
  const context = params.context

  return new Promise(function (resolve) {
    const job = engine.enqueueJobWithFlattenedParams(jobs.Request.lspCodeAction, { uri, range, context })
    socket.eventEmitter.once(job.id, ({ status, result }) => resolve(result))
  })
}

/**
 * @function
 */
export const handleWorkspaceSymbols = makeEnqueuePromise(makeWorkspaceSymbolsJob, makeDefaultResponseHandler) as (
  params: any,
) => Promise<any>

function makeWorkspaceSymbolsJob(params: any) {
  return {
    request: jobs.Request.lspWorkspaceSymbols,
    position: params.position,
    query: params.query || '',
  }
}
