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
import { StatusCode } from '../util/statusCodes'

type ResponseHandler = ({ status, result }: socket.FlixResponse) => void

export function makeDefaultResponseHandler(promiseResolver: (result?: socket.FlixResult) => void): ResponseHandler {
  return function responseHandler({ status, result }: socket.FlixResponse) {
    if (status === StatusCode.Success) {
      promiseResolver(result)
    } else {
      promiseResolver()
    }
  }
}

/**
 * Function to enqueue a job.
 * A promise is returned that is finally resolved with the result of running the command.
 *
 * @param jobOrGetJob - Either a Job with request and optional params or a function that returns a Job
 * @param makeResponseHandler
 */
export function makeEnqueuePromise<JobParams extends unknown[]>(
  jobOrGetJob: jobs.Job | ((...params: JobParams) => jobs.Job),
  makeResponseHandler?: (promiseResolver: (result?: socket.FlixResult) => void) => ResponseHandler,
) {
  return function enqueuePromise(...params: JobParams) {
    return new Promise(function (resolve) {
      const { request, ...jobData } = typeof jobOrGetJob === 'function' ? jobOrGetJob(...params) : jobOrGetJob
      const job = engine.enqueueJobWithFlattenedParams(request, jobData)
      const handler = makeResponseHandler || makeDefaultResponseHandler
      socket.eventEmitter.once(job.id, handler(resolve))
    })
  }
}

export function makePositionalHandler(
  type: jobs.Request,
  makeResponseHandler?: (promiseResolver: (result?: socket.FlixResult) => void) => ResponseHandler,
) {
  return function positionalHandler(params: any): Thenable<any> {
    const uri = params.textDocument?.uri
    const position = params.position
    return makeEnqueuePromise({ request: type, uri, position }, makeResponseHandler)()
  }
}
