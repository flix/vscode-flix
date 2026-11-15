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
import { SemVer } from '../util/semVer'

/**
 * What the extension remembers across windows and restarts about the compilers it has downloaded.
 *
 * Which compilers are installed is not part of it: the jars in global storage are named after their
 * version, so the files themselves are the record.
 *
 * In the test environment nothing is remembered from one run to the next, since the `Memento` of
 * the extension is reset between runs.
 */
let globalState: vscode.Memento

export default function initialise(context: vscode.ExtensionContext) {
  globalState = context.globalState
}

enum StateKeys {
  lastUpdateCheck = 'lastUpdateCheck',
  releaseNotes = 'releaseNotes',
}

/**
 * The release notes of the compiler which was downloaded last.
 */
export interface ReleaseNotes {
  version: SemVer
  description: string

  /**
   * Whether the notes have been shown to the user.
   */
  shown: boolean
}

/**
 * Returns the time at which GitHub last told us what the latest release is, in milliseconds since
 * the epoch, or `0` if it never has.
 */
export function getLastUpdateCheck(): number {
  return globalState?.get(StateKeys.lastUpdateCheck, 0) ?? 0
}

export async function setLastUpdateCheck(time: number) {
  await globalState?.update(StateKeys.lastUpdateCheck, time)
}

export function getReleaseNotes(): ReleaseNotes | undefined {
  return globalState?.get(StateKeys.releaseNotes)
}

export async function setReleaseNotes(releaseNotes: ReleaseNotes) {
  await globalState?.update(StateKeys.releaseNotes, releaseNotes)
}
