import * as vscode from 'vscode'
import * as jobs from '../protocol/requests'
import eventEmitter from '../util/eventBus'
import * as timers from '../util/timers'
import { USER_MESSAGE } from './messages'

export default function showStartupProgress(timeout: number = 30) {
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: USER_MESSAGE.INFORM_STARTING_FLIX(),
      cancellable: false,
    },
    function (_progress) {
      return new Promise(function resolver(resolve, reject) {
        const cancelCleanup = timers.ensureCleanupEventually(reject, timeout)

        eventEmitter.on(jobs.Request.internalReady, function readyHandler() {
          cancelCleanup()
          resolve(undefined)
        })
      })
    },
  )
}
