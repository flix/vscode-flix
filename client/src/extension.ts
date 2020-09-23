import * as path from 'path'
import * as vscode from 'vscode'

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient'

import * as jobs from './engine/jobs'

const _ = require('lodash/fp')

interface LaunchOptions {
  shouldUpdateFlix: boolean
}

let client: LanguageClient

let flixWatcher: vscode.FileSystemWatcher

const EXTENSION_PATH = vscode.extensions.getExtension('flix.flix').extensionPath
const FLIX_GLOB_PATTERN = '**/*.flix'

/**
 * Convert URI to file scheme URI shared by e.g. TextDocument's URI.
 * 
 * @param uri {vscode.Uri}
 */
function vsCodeUriToUriString (uri: vscode.Uri) {
  return vscode.Uri.file(uri.path).toString(false)
}

function restartClient (context: vscode.ExtensionContext, launchOptions?: LaunchOptions) {
  return async function () {
    await deactivate()
    await activate(context, launchOptions)
  }
}

export async function activate(context: vscode.ExtensionContext, launchOptions?: LaunchOptions) {
  // The server is implemented in node
  let serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'))
  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] }

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  let serverOptions: ServerOptions = {
    run: { 
      module: serverModule,
      transport: TransportKind.ipc
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions
    }
  }

  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    // Register the server for flix documents
    documentSelector: [{ scheme: 'file', language: 'flix' }],
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
    }
  }

  // Create the language client and start the client.
  client = new LanguageClient(
    'flixLanguageServer',
    'Flix Language Server',
    serverOptions,
    clientOptions
  )

  // Start the client. This will also launch the server
  client.start()

  // Wait for client and server to be ready before registering listeners
  await client.onReady()

  const registeredCommands = await vscode.commands.getCommands(true)
  const flixInternalRestart = 'flix.internalRestart'
  if (!_.includes(flixInternalRestart, registeredCommands)) {
    vscode.commands.registerCommand(flixInternalRestart, restartClient(context, { shouldUpdateFlix: false }))
  }

  // watch for changes on the file system (delete, create, rename .flix files)
  flixWatcher = vscode.workspace.createFileSystemWatcher(FLIX_GLOB_PATTERN)
  flixWatcher.onDidDelete((vsCodeUri: vscode.Uri) => {
    const uri = vsCodeUriToUriString(vsCodeUri)
    client.sendNotification(jobs.Request.apiRemUri, { uri })
  })
  flixWatcher.onDidCreate((vsCodeUri: vscode.Uri) => {
    const uri = vsCodeUriToUriString(vsCodeUri)
    client.sendNotification(jobs.Request.apiAddUri, { uri })
  })

  const workspaceFolders = _.map(_.flow(_.get('uri'), _.get('fsPath')), vscode.workspace.workspaceFolders)
  const workspaceFiles: [string] = _.map(vsCodeUriToUriString, (await vscode.workspace.findFiles(FLIX_GLOB_PATTERN)))

  client.sendNotification(jobs.Request.internalReady, {
    workspaceFolders,
    extensionPath: EXTENSION_PATH || context.extensionPath,
    globalStoragePath: context.globalStoragePath,
    workspaceFiles,
    launchOptions
  })

  client.onNotification(jobs.Request.internalRestart, restartClient(context))

  client.onNotification(jobs.Request.internalMessage, vscode.window.showInformationMessage)

  client.onNotification(jobs.Request.internalError, vscode.window.showErrorMessage)
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined
  }
  flixWatcher.dispose()
  return client.stop()
}
