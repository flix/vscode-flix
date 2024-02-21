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
import * as vscode from 'vscode'
import { FlixRelease } from './releases'
import { openFlixReleaseOverview } from './releaseVirtualDocument'

let globalState: vscode.Memento

export default function initialise(context: vscode.ExtensionContext) {
  globalState = context.globalState
}

enum StateKeys {
  installedFlixVersion = 'installedFlixVersion',
}

/**
 * Get the installed Flix release if one exists.
 *
 * In the test environment this will always return `undefined` when called the first time in a test run,
 * even if an installed Flix compiler exists.
 * This happens because the extension's 'Memento' is reset between each run.
 */
export function getInstalledFlixVersion(): FlixRelease | undefined {
  return globalState?.get(StateKeys.installedFlixVersion)
}

export async function setInstalledFlixVersion(value: FlixRelease) {
  await globalState?.update(StateKeys.installedFlixVersion, value)
  return openFlixReleaseOverview(value)
}
