import * as vscode from 'vscode'
import { LanguageClient } from 'vscode-languageclient'

import * as jobs from '../engine/jobs'
import eventEmitter from '../services/eventEmitter'

export function makeHandleRunCommand (
  client: LanguageClient, 
  outputChannel: vscode.OutputChannel, 
  request: jobs.Request, 
  title: string, 
  timeout: number = 180
) {
  return function handler () {
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title,
      cancellable: false
    }, function (_progress) {
      return new Promise(function resolver (resolve, reject) {
        client.sendNotification(request)
  
        const tookTooLong = setTimeout(function tookTooLongHandler () {
          vscode.window.showErrorMessage(`Command timed out after ${timeout} seconds`)
          reject()
        }, timeout * 1000)
  
        eventEmitter.on(jobs.Request.internalFinishedJob, function readyHandler () {
          clearTimeout(tookTooLong)
          outputChannel.show()
          resolve()
        })

        eventEmitter.on(jobs.Request.internalRestart, function readyHandler () {
          // stop the run command if we restart for some reason
          clearTimeout(tookTooLong)
          resolve()
        })
      })
    })
  }
}
