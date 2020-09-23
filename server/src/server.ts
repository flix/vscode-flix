import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  PublishDiagnosticsParams
} from 'vscode-languageserver'

import { TextDocument } from 'vscode-languageserver-textdocument'

import * as handlers from './handlers'
import * as jobs from './engine/jobs'

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all)

// Create a simple text document manager.
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

// Initialise tells the client which capabilities we support
connection.onInitialize(handlers.handleInitialize)

// Event happens once after either startup or a restart - starts the engine
connection.onNotification(jobs.Request.internalReady, handlers.handleReady)

// A file has been added or updated
connection.onNotification(jobs.Request.apiAddUri, handlers.handleAddUri)

// A file has been removed
connection.onNotification(jobs.Request.apiRemUri, handlers.handleRemUri)

// Cleanup after exit
connection.onExit(handlers.handleExit)

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(handlers.handleChangeContent)

// Document has been saved
documents.onDidSave(handlers.handleChangeContent)

// Go to definition (from context menu or F12 usually)
connection.onDefinition(handlers.handleGotoDefinition)

// Hover over [line, character]
connection.onHover(handlers.handleHover)

// Find uses of (references to)
connection.onReferences(handlers.handleReferences)

connection.onSelectionRanges(handlers.handleSelectionRanges)

connection.onCodeLens(handlers.handleCodelens)

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection)

// Listen on the connection - now everything is running
connection.listen()

/**
 * Send arbitrary notifications back to the client.
 * 
 * @param notificationType {String} - Notification key, has to match a listener in the client
 * @param payload {*} - Anything (can be empty)
 */
export function sendNotification (notificationType: string, payload?: any) {
  connection.sendNotification(notificationType, payload)
}

// A set of files that previously had errors which should be cleared when a new lsp/check is performed
// VS Code remembers files with errors and won't clear them itself.
let fileUrisWithErrors: Set<string> = new Set()

/**
 * Clear `fileUrisWithErrors` after removing error flags for all `uri`s.
 */
export function clearDiagnostics () {
  fileUrisWithErrors.forEach((uri: string) => sendDiagnostics({ uri, diagnostics: [] }))
  fileUrisWithErrors.clear()
}

/**
 * Proxy for `connection.sendDiagnostics` that also adds the `uri` to `fileUrisWithErrors`.
 */
export function sendDiagnostics (params: PublishDiagnosticsParams) {
  fileUrisWithErrors.add(params.uri)
  connection.sendDiagnostics(params)
}
