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
 * The messages this extension exchanges with the Flix language server: each entry is one the
 * client sends, one it listens for, or both.
 *
 * The standard LSP methods are deliberately absent. The client never issues those itself: VS Code
 * calls `onHover`, `onDefinition` and friends on the server, which turns them into jobs using its
 * own enum in `server/src/engine/jobs.ts`. That enum, not this one, has to cover the whole protocol.
 */
export enum Request {
  apiAddUri = 'api/addUri',
  apiRemUri = 'api/remUri',
  apiMinVSCodeVersion = 'api/minVSCodeVersion',
  apiRestart = 'api/restart',

  lspShowAst = 'lsp/showAst',

  internalReady = 'ext/ready', // Internal Extension Request
  internalMessage = 'ext/message', // Internal Extension Request
  internalError = 'ext/error', // Internal Extension Request
  internalFinishedJob = 'ext/finished', // Internal Extension Request
  internalFinishedAllJobs = 'ext/finishedAll', // Internal Extension Request
  internalDiagnostics = 'ext/diagnostics', // Internal Extension Request
  internalRecompiling = 'ext/recompiling', // Internal Extension Request
  internalReplaceConfiguration = 'ext/replaceConfiguration', // Internal Extension Request
}
