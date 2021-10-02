/*
 * Copyright 2020 Thomas Plougsgaard
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @enum
 *
 * Request types matching that of the LSP implementation.
 *
 * NOTE: This is mirrored ("shared") between client and server by way of carbon copy.
 *
 * @see https://github.com/flix/flix/blob/b4b9041cc89b8be04c173ce0b0f58a69e6993739/main/src/ca/uwaterloo/flix/api/lsp/LanguageServer.scala#L163
 */
export enum Request {
  apiAddUri = 'api/addUri',
  apiRemUri = 'api/remUri',
  apiAddPkg = 'api/addPkg',
  apiRemPkg = 'api/remPkg',
  apiVersion = 'api/version',
  apiShutdown = 'api/shutdown',

  cmdRunTests = 'cmd/runTests',

  lspCheck = 'lsp/check',
  lspCodelens = 'lsp/codelens',
  lspHighlight = 'lsp/highlight',
  lspComplete = 'lsp/complete',
  lspHover = 'lsp/hover',
  lspGoto = 'lsp/goto',
  lspImplementation = 'lsp/implementation',
  lspUses = 'lsp/uses',
  lspRename = 'lsp/rename',
  lspDocumentSymbols = 'lsp/documentSymbols',
  lspWorkspaceSymbols = 'lsp/workspaceSymbols',

  internalRestart = 'ext/restart', // Internal Extension Request
  internalDownloadLatest = 'ext/downloadLatest', // Internal Extension Request
  internalReady = 'ext/ready', // Internal Extension Request
  internalMessage = 'ext/message', // Internal Extension Request
  internalError = 'ext/error', // Internal Extension Request
  internalFinishedJob = 'ext/finished', // Internal Extension Request
  internalDiagnostics = 'ext/diagnostics', // Internal Extension Request
  internalReplaceConfiguration = 'ext/replaceConfiguration' // Internal Extension Request
}
