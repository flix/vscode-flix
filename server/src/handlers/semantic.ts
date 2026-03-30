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

import { InlayHintParams } from 'vscode-languageserver'

import * as jobs from '../engine/jobs'
import * as engine from '../engine'
import * as socket from '../engine/socket'

import { makePositionalHandler, makeDefaultResponseHandler } from './util'

/**
 * @function
 */
export const handleSemanticTokens = makePositionalHandler(jobs.Request.lspSemanticTokens)

export const handleInlayHints = (params: InlayHintParams): Thenable<any> =>
  new Promise(resolve => {
    const job = engine.enqueueJobWithFlattenedParams(jobs.Request.lspInlayHints, {
      uri: params.textDocument.uri,
      range: params.range,
    })
    socket.eventEmitter.once(job.id, makeDefaultResponseHandler(resolve))
  })
