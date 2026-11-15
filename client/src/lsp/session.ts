import * as vscode from 'vscode'
import { LanguageClient } from 'vscode-languageclient/node'

import * as jobs from '../protocol/requests'
import ensureFlixExists from '../compiler/download'
import showStartupProgress from '../ui/startupProgress'
import { FlixLspTerminal } from '../ui/compilerTerminal'
import { discoverWorkspaceFiles } from './fileWatchers'
import { setupNotificationListeners, getUserConfiguration } from './notifications'

const extensionObject = vscode.extensions.getExtension('flix.flix')

/**
 * The jar of the compiler the session runs on, or `undefined` as long as none has been chosen.
 */
let sessionFlixJar: string | undefined

/**
 * Returns the path of the jar the session runs on, or `undefined` if the session has no compiler:
 * either it is still being chosen, or there is none and it could not be downloaded.
 *
 * The jar is chosen once, when the session starts, and everything which runs Flix is launched from
 * it. A newer compiler which is downloaded later is not used before the window is loaded again.
 */
export function getSessionFlixJar(): string | undefined {
  return sessionFlixJar
}

/**
 * Starts the session: chooses the compiler and tells the server to start it.
 *
 * A window has exactly one session, started when the extension is activated. The window has to be
 * reloaded to start on another compiler.
 */
export async function startSession(
  context: vscode.ExtensionContext,
  client: LanguageClient,
  flixLspTerminal: FlixLspTerminal,
  onReady: () => void,
) {
  const globalStoragePath = context.globalStorageUri.fsPath
  const workspaceFolders = vscode.workspace.workspaceFolders?.map(ws => ws.uri.fsPath)

  // In project mode, discover files via workspace glob patterns.
  // In single-file mode, use the currently open .flix documents instead.
  const workspaceFiles = await discoverWorkspaceFiles()

  // Wait until we're sure flix exists
  const flixFilename = await ensureFlixExists({
    globalStoragePath,
    workspaceFolders,
    // Nobody answers a prompt under the test runner. A newer compiler is downloaded without
    // asking instead, so that a local test run uses the latest one, as a run on CI does.
    askBeforeUpdate: context.extensionMode !== vscode.ExtensionMode.Test,
  })
  sessionFlixJar = flixFilename

  // Show a startup progress that times out after 10 (default) seconds
  showStartupProgress()

  // Send start notification to the server which actually starts the Flix compiler
  client.sendNotification(jobs.Request.internalReady, {
    flixFilename,
    workspaceFolders,
    extensionPath: extensionObject.extensionPath || context.extensionPath,
    extensionVersion: extensionObject.packageJSON.version,
    globalStoragePath,
    workspaceFiles,
    userConfiguration: getUserConfiguration(),
  })

  // Handle when server has answered back after getting the notification above
  setupNotificationListeners(client, flixLspTerminal, onReady)
}
