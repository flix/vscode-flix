import * as vscode from 'vscode'
import { LanguageClient } from 'vscode-languageclient/node'

import * as jobs from '../engine/jobs'
import ensureFlixExists from '../util/ensureFlixExists'
import showStartupProgress from '../util/showStartupProgress'
import eventEmitter from '../services/eventEmitter'
import { FlixLspTerminal } from '../services/flixLspTerminal'
import { discoverWorkspaceFiles } from './fileWatchers'
import { setupNotificationListeners, getUserConfiguration } from './notifications'

const extensionObject = vscode.extensions.getExtension('flix.flix')

export async function startSession(
  context: vscode.ExtensionContext,
  launchOptions: { shouldUpdateFlix?: boolean },
  client: LanguageClient,
  outputChannel: vscode.OutputChannel,
  flixLspTerminal: FlixLspTerminal,
  onReady: () => void,
) {
  // clear listeners from previous sessions
  eventEmitter.removeAllListeners()

  // clear outputs
  outputChannel.clear()

  const globalStoragePath = context.globalStorageUri.fsPath
  const workspaceFolders = vscode.workspace.workspaceFolders?.map(ws => ws.uri.fsPath)

  // In project mode, discover files via workspace glob patterns.
  // In single-file mode, use the currently open .flix documents instead.
  const { workspaceFiles, workspacePkgs, workspaceJars } = await discoverWorkspaceFiles()

  // Wait until we're sure flix exists
  const flixFilename = await ensureFlixExists({
    globalStoragePath,
    workspaceFolders,
    shouldUpdateFlix: launchOptions.shouldUpdateFlix,
  })

  // A staged update was downloaded — a reload prompt is already showing.
  // Skip engine startup so the user doesn't see a stale "Starting Flix" progress.
  if (!flixFilename) {
    return
  }

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
    workspacePkgs,
    workspaceJars,
    userConfiguration: getUserConfiguration(),
  })

  // Handle when server has answered back after getting the notification above
  setupNotificationListeners(client, flixLspTerminal, onReady)
}
