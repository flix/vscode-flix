import * as vscode from 'vscode'
import { LanguageClient } from 'vscode-languageclient/node'
import { EventEmitter } from 'events'
import * as jobs from '../protocol/requests'

/**
 * Request that the server should disconnect. Returns promise that will resolve when the server has been reconnected.
 * Used for testing purposes.
 */
export function simulateDisconnect(client: LanguageClient) {
  return () => client.sendNotification(jobs.Request.apiDisconnect)
}

export function makeHandleRunJob(client: LanguageClient, request: jobs.Request) {
  return function handler() {
    client.sendNotification(request)
  }
}

/**
 * Prompt the user for a phase and show the AST for that phase.
 *
 * @returns function handler
 */
export function showAst(client: LanguageClient) {
  return async function handler() {
    client.sendNotification(jobs.Request.lspShowAst, {
      uri: vscode.window.activeTextEditor.document.uri.fsPath,
    })
  }
}

export function allJobsFinished(client: LanguageClient, eventEmitter: EventEmitter) {
  return () =>
    new Promise(resolve => {
      client.sendNotification(jobs.Request.internalFinishedAllJobs)
      eventEmitter.once(jobs.Request.internalFinishedAllJobs, resolve)
    })
}
