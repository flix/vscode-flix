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

import * as vscode from 'vscode';
import { FlixRelease } from './releases';
import { getInstalledFlixVersion } from './state';

/**
 * The scheme used to distinguish our documents.
 */
const scheme = 'flixcompiler';

/**
 * Handle documents where the uri scheme is [[scheme]] (flixcompiler):
 *  - check whether the current installed version of the compiler is the same for which we want to display the release changelog.
 *  - returns the body of the document to be displayed.
 */
const flixReleaseDocumentProvider = new (class implements vscode.TextDocumentContentProvider {
  provideTextDocumentContent(uri: vscode.Uri): string {
      // use uri-path as text
      const id = new Number(uri.path.split('/')[0]);
      const installedVersion = getInstalledFlixVersion();
      if (id == installedVersion.id) {
        return `# New Flix Release!\n` + 
            `## Version: ${installedVersion.version.major}.${installedVersion.version.minor}.${installedVersion.version.patch}\n`
            + `${installedVersion.description}`;
      } else {
        throw new Error(`The current installed compiler (${installedVersion.id}) doesn't match the requested one (${id}).`);
      }
    }
  })();

/**
 * Open and show the document given by the provider when for the given [[uri]].
 * Set the document language to plaintext.
 * @param uri the path of is the id of the flix compiler.
 */
async function openFlixReleaseDocument(uri: vscode.Uri) {
  // trigger the provider.
  await vscode.commands.executeCommand("markdown.showPreview", uri);
}

/**
 * Builds a uri which is recognised by the flixReleaseDocumentProvider.
 * @param id of the release we are willing to display
 */
function createFlixReleaseContentUri({ id }: FlixRelease): vscode.Uri {
  const uri = vscode.Uri.from({
    scheme,
    path: `${id}/CHANGELOG`,
  });
  return uri;
}

/**
 * Open the release changelog if [[flixRelease]] is the same release that was previously.
 * @param flixRelease a release of the flix compiler.
 */
export async function openFlixReleaseOverview(flixRelease: FlixRelease) {
  await openFlixReleaseDocument(createFlixReleaseContentUri(flixRelease));
}

/**
 * Register the provider.  
 */
 export function registerFlixReleaseDocumentProvider({ subscriptions }: vscode.ExtensionContext) {
    subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(scheme, flixReleaseDocumentProvider));
}


