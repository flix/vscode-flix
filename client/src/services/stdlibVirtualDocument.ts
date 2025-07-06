/*
 * Copyright 2024 Flix contributors
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
import AdmZip from 'adm-zip'
import * as fs from 'fs'

/**
 * The scheme used to distinguish stdlib documents from jar files.
 */
const scheme = 'flixstdlib'

/**
 * Handle documents where the uri scheme is [[scheme]] (flixstdlib):
 * - Extract the jar path and file path from the URI
 * - Read the file content from inside the jar
 * - Return the file content for display
 */
const flixStdlibDocumentProvider = new (class implements vscode.TextDocumentContentProvider {
  provideTextDocumentContent(uri: vscode.Uri): string {
    try {
      const jarPath = decodeURIComponent(uri.authority)
      const filePath = uri.path.startsWith('/') ? uri.path.substring(1) : uri.path
      
      if (!fs.existsSync(jarPath)) {
        return `// Error: Flix jar file not found at: ${jarPath}`
      }
      
      const zip = new AdmZip(jarPath)
      let entry = zip.getEntry(filePath)
      let searchedPaths = [filePath]
      
      // If not found at root level, try common stdlib directories
      if (!entry && !filePath.startsWith('src/')) {
        const commonPaths = [
          `src/library/${filePath}`,
          `src/resources/${filePath}`,
        ]
        
        for (const path of commonPaths) {
          entry = zip.getEntry(path)
          searchedPaths.push(path)
          if (entry) break
        }
      }
      
      if (!entry) {
        return `// Error: File '${filePath}' not found in jar: ${jarPath}\n// Searched paths: ${searchedPaths.join(', ')}`
      }
      
      return entry.getData().toString('utf8')
    } catch (error) {
      return `// Error reading stdlib file: ${error.message}`
    }
  }
})()

/**
 * Register the stdlib document provider.
 */
export function registerFlixStdlibDocumentProvider({ subscriptions }: vscode.ExtensionContext) {
  subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(scheme, flixStdlibDocumentProvider))
} 