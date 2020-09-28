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

import * as jobs from '../engine/jobs'
import * as engine from '../engine'
import * as socket from '../engine/socket'
import { hasErrors } from '../server'

export function makeDefaultResponseHandler (promiseResolver: Function) {
  return function responseHandler ({ status, result }: socket.FlixResponse) {
    if (status === 'success') {
      promiseResolver(result)
    } else {
      promiseResolver()
    }
  }
}

export function makeEnqueuePromise (type: jobs.Request, makeResponseHandler?: Function, uri?: string, position?: any) {
  return function enqueuePromise () {
    return new Promise(function (resolve) {
      const job = engine.enqueueJobWithPosition(type, uri, position)
      const handler = makeResponseHandler || makeDefaultResponseHandler
      socket.eventEmitter.once(job.id, handler(resolve))
    })
  }
}

/**
 * Function to enqueue a job unless errors are present.
 * If errors are present the hasErrorsHandler is called.
 * Otherwise a promise is returned that is finally resolved with the result of running the command.
 * 
 * @param type 
 * @param makeResponseHandler 
 * @param hasErrorsHandler 
 */
export function enqueueUnlessHasErrors (type: jobs.Request, makeResponseHandler?: Function, hasErrorsHandler?: Function) {
  if (typeof hasErrorsHandler !== 'function') {
    // development check (remove later)
    throw '`enqueueUnlessHasErrors` must have `hasErrorsHandler` when called with errors'
  }
  return function enqueuePromise () {
    if (hasErrors() && hasErrorsHandler) {
      return hasErrorsHandler()
    }
    return new Promise(function (resolve) {
      const job = engine.enqueueJobWithPosition(type)
      const handler = makeResponseHandler || makeDefaultResponseHandler
      socket.eventEmitter.once(job.id, handler(resolve))
    })
  }
}

export function makePositionalHandler (type: jobs.Request, handlerWhenErrorsExist?: Function, makeResponseHandler?: Function) {
  return function positionalHandler (params: any): Thenable<any> {
    if (hasErrors() && handlerWhenErrorsExist) {
      // NOTE: At present this isn't used by anyone (neither is makeResponseHandler)
      return handlerWhenErrorsExist()
    }
    const uri = params.textDocument ? params.textDocument.uri : undefined
    const position = params.position
    return makeEnqueuePromise(type, makeResponseHandler, uri, position)()
  }
}
