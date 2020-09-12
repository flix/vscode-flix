// Allow import of internal and external JS modules without TypeScript complaining
// To a TypeScript proponent this is surely very bad form
import './allowJavascriptModules'

import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  TextDocumentSyncKind,
  InitializeResult
} from 'vscode-languageserver'

import {
  handleChangeContent,
  handleCompletion, 
  handleCompletionResolve
} from './handlers'

import * as engine from './engine'

import { TextDocument } from 'vscode-languageserver-textdocument'

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
export let connection = createConnection(ProposedFeatures.all)

// Create a simple text document manager.
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

let hasConfigurationCapability: boolean = false
let hasWorkspaceFolderCapability: boolean = false
let hasDiagnosticRelatedInformationCapability: boolean = false

// root path for client's files
let rootPath: string

/**
 * Runs when both client and server are ready.
 * 
 * @param {String} obj.extensionPath - Install path of this extension.
 */
function handleReady (engineInput: engine.StartEngineInput) {
  engine.start({ ...engineInput, rootPath })
}

function handleExit () {
  engine.stop()
}

connection.onInitialize((params: InitializeParams) => {
  let capabilities = params.capabilities

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  )
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  )
  hasDiagnosticRelatedInformationCapability = !!(
    capabilities.textDocument &&
    capabilities.textDocument.publishDiagnostics &&
    capabilities.textDocument.publishDiagnostics.relatedInformation
  )

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion.
      completionProvider: {
        resolveProvider: true
      }
    }
  }
  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true
      }
    }
  }

  if (!params.rootPath) {
    // at this stage we require a root path for client files
    throw new Error('Unable to get root path for files')
  }
  rootPath = params.rootPath!

  return result
})

connection.onInitialized((_params) => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(DidChangeConfigurationNotification.type, undefined)
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(_event => {
      connection.console.log('Workspace folder change event received.')
    })
  }
})

connection.onNotification('ready', handleReady)

connection.onExit(handleExit)

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(handleChangeContent)

// Document has been saved
documents.onDidSave(handleChangeContent)

connection.onCompletion(handleCompletion)

connection.onCompletionResolve(handleCompletionResolve)

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection)

// Listen on the connection
connection.listen()
