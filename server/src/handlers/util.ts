import * as jobs from '../engine/jobs'
import * as engine from '../engine'
import * as socket from '../engine/socket'

export function makeDefaultResponseHandler (promiseResolver: Function) {
  return function responseHandler ({ status, result }: socket.FlixResponse, ) {
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

export function makePositionalHandler (type: jobs.Request, makeResponseHandler?: Function) {
  return function positionalHandler (params: any): Thenable<any> {
    const uri = params.textDocument ? params.textDocument.uri : undefined
    const position = params.position
    return makeEnqueuePromise(type, makeResponseHandler, uri, position)()
  }
}
