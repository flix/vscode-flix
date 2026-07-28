import * as vscode from 'vscode'
import { LanguageClient } from 'vscode-languageclient/node'
import { EventEmitter } from 'events'
import * as jobs from '../protocol/requests'

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

/**
 * Adds the file with the given `uri` and `src` content to the compiler.
 *
 * Unlike the file watchers, this does not require the file to be part of the workspace, and the
 * content is taken from `src` rather than from disk. Tests use this to load a workspace without
 * copying any files into place, and to empty a file again by adding it with no content.
 */
export function addUri(client: LanguageClient) {
  return (uri: string, src: string) => client.sendNotification(jobs.Request.apiAddUri, { uri, src })
}

export function allJobsFinished(client: LanguageClient, eventEmitter: EventEmitter) {
  return () =>
    new Promise(resolve => {
      client.sendNotification(jobs.Request.internalFinishedAllJobs)
      eventEmitter.once(jobs.Request.internalFinishedAllJobs, resolve)
    })
}
