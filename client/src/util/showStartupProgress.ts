import * as vscode from 'vscode'
import eventEmitter from '../services/eventEmitter'
import * as jobs from '../engine/jobs'

export default function showStartupProgress () {
  vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Starting Flix',
    cancellable: false
  }, function (_progress) {
    return new Promise(function resolver (resolve, reject) {
      const tookTooLong = setTimeout(function tookTooLongHandler () {
        vscode.window.showErrorMessage('Timed out trying to start.')
        reject()
      }, 10 * 1000)

      eventEmitter.on(jobs.Request.internalReady, function readyHandler () {
        clearTimeout(tookTooLong)
        resolve()
      })
    })
  })
}
