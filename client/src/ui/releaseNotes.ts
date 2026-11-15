/*
 * Copyright 2022 Nicola Dardanis
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
import { USER_MESSAGE } from './messages'
import { getReleaseNotes, setReleaseNotes } from '../compiler/globalState'
import { compareSemVer, SemVer, showSemVer } from '../util/semVer'

/**
 * The scheme used to distinguish our documents.
 */
const scheme = 'flixcompiler'

/**
 * Handle documents where the uri scheme is [[scheme]] (flixcompiler):
 *  - check whether the stored release notes are the ones of the version for which we want to display the release changelog.
 *  - returns the body of the document to be displayed.
 */
const flixReleaseDocumentProvider = new (class implements vscode.TextDocumentContentProvider {
  provideTextDocumentContent(uri: vscode.Uri): string {
    // use uri-path as text
    const version = uri.path.split('/')[0]
    const releaseNotes = getReleaseNotes()
    if (releaseNotes !== undefined && version === showSemVer(releaseNotes.version)) {
      const msg = USER_MESSAGE.SHOW_CHANGELOG(releaseNotes)
      return msg
    } else {
      const msg = USER_MESSAGE.INFORM_NO_CHANGELOG()
      return msg
    }
  }
})()

/**
 * Open and show the document given by the provider when for the given [[uri]].
 * Set the document language to plaintext.
 * @param uri the path of is the version of the flix compiler.
 */
async function openFlixReleaseDocument(uri: vscode.Uri) {
  // trigger the provider.
  await vscode.commands.executeCommand('markdown.showPreview', uri)
}

/**
 * Builds a uri which is recognised by the flixReleaseDocumentProvider.
 * @param version of the release we are willing to display
 */
function createFlixReleaseContentUri(version: SemVer): vscode.Uri {
  const uri = vscode.Uri.from({
    scheme,
    path: `${showSemVer(version)}/CHANGELOG`,
  })
  return uri
}

/**
 * Open the release changelog of the compiler with the given [[version]], which a session is
 * starting on, if it is the compiler which was downloaded last and its changelog has not been
 * shown before.
 *
 * Whether it has been shown is stored rather than kept in memory: a compiler which is downloaded
 * while a session is running is only started on after the window has been reloaded.
 * @param version the version of the flix compiler the session is starting on.
 */
export async function showNewReleaseNotes(version: SemVer) {
  const releaseNotes = getReleaseNotes()
  if (releaseNotes === undefined || releaseNotes.shown || compareSemVer(releaseNotes.version, version) !== 0) {
    return
  }
  await setReleaseNotes({ ...releaseNotes, shown: true })
  await openFlixReleaseDocument(createFlixReleaseContentUri(version))
}

/**
 * Register the provider.
 */
export function registerFlixReleaseDocumentProvider({ subscriptions }: vscode.ExtensionContext) {
  subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(scheme, flixReleaseDocumentProvider))
}
