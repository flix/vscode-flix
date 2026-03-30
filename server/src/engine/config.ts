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

export interface UserConfiguration {
  extraJvmArgs: string
  extraFlixArgs: string
}

/**
 * Payload sent from the client via the `internalReady` notification.
 *
 * In single-file mode (no folder open) `workspaceFolders` is omitted and
 * `workspaceFiles` contains only the currently open `.flix` file(s).
 */
export interface StartEngineInput {
  flixFilename: string
  workspaceFolders?: string[]
  extensionPath: string
  extensionVersion: string
  globalStoragePath: string
  workspaceFiles: string[]
  workspacePkgs: string[]
  workspaceJars: string[]
  userConfiguration: UserConfiguration
}
