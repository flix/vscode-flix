import * as vscode from 'vscode'
import { LanguageClient } from 'vscode-languageclient/node'
import * as jobs from '../protocol/requests'
import {
  isProjectMode,
  getFlixGlobPattern,
  getFpkgGlobPattern,
  getJarGlobPattern,
  getFlixTomlGlobPattern,
} from '../util/workspace'

let flixWatcher: vscode.FileSystemWatcher
let pkgWatcher: vscode.FileSystemWatcher
let jarWatcher: vscode.FileSystemWatcher
let tomlWatcher: vscode.FileSystemWatcher

let knownFlixFiles: Set<string> = new Set()
let reconcileTimer: ReturnType<typeof setTimeout> | undefined

/**
 * How long a manifest event waits for the next one before the REPL is rebooted.
 */
const REPL_REBOOT_DEBOUNCE_MS = 300

let replRebootTimer: ReturnType<typeof setTimeout> | undefined

/**
 * Convert URI to file scheme URI shared by e.g. TextDocument's URI.
 *
 * @param uri {vscode.Uri}
 */
export function vsCodeUriToUriString(uri: vscode.Uri) {
  return vscode.Uri.file(uri.path).toString(false)
}

/**
 * Re-scans the filesystem and diffs against the known source files.
 * Sends add/rem notifications for any discrepancies.
 *
 * This handles folder deletion/creation where onDidDelete/onDidCreate
 * fires for the folder but not for individual files inside it.
 *
 * Packages and JARs are not reconciled: `lib/` is where the compiler installs the dependencies the
 * manifest declares, so it is the compiler's to keep, and a change to it is reported as it happens.
 */
async function reconcileFiles(client: LanguageClient) {
  if (!isProjectMode()) {
    return
  }

  const currentFlix = new Set((await vscode.workspace.findFiles(getFlixGlobPattern())).map(vsCodeUriToUriString))

  for (const uri of knownFlixFiles) {
    if (!currentFlix.has(uri)) {
      client.sendNotification(jobs.Request.apiRemUri, { uri })
    }
  }
  for (const uri of currentFlix) {
    if (!knownFlixFiles.has(uri)) {
      client.sendNotification(jobs.Request.apiAddUri, { uri })
    }
  }

  knownFlixFiles = currentFlix
}

function scheduleReconciliation(client: LanguageClient) {
  if (reconcileTimer !== undefined) {
    clearTimeout(reconcileTimer)
  }
  reconcileTimer = setTimeout(() => {
    reconcileTimer = undefined
    reconcileFiles(client)
  }, 300)
}

/**
 * Reboot the REPL once the manifest events have settled.
 *
 * Writing a file is not one event: an editor which saves it, or a tool which rewrites it, can
 * report a handful in a row. Rebooting the REPL spawns a JVM in a terminal, so a burst is collapsed
 * into a single reboot. The restart sent to the compiler needs no such care: the server throttles
 * it already.
 */
function scheduleReplReboot(onRestartRepl: () => void) {
  if (replRebootTimer !== undefined) {
    clearTimeout(replRebootTimer)
  }
  replRebootTimer = setTimeout(() => {
    replRebootTimer = undefined
    onRestartRepl()
  }, REPL_REBOOT_DEBOUNCE_MS)
}

/**
 * Set up file system watchers for project mode.
 * Watches .flix, .fpkg, .jar, and flix.toml files.
 */
export function setupProjectWatchers(client: LanguageClient, onRestartRepl: () => void) {
  flixWatcher = vscode.workspace.createFileSystemWatcher(getFlixGlobPattern())
  flixWatcher.onDidDelete((vsCodeUri: vscode.Uri) => {
    const uri = vsCodeUriToUriString(vsCodeUri)
    knownFlixFiles.delete(uri)
    client.sendNotification(jobs.Request.apiRemUri, { uri })
    scheduleReconciliation(client)
  })
  flixWatcher.onDidCreate((vsCodeUri: vscode.Uri) => {
    const uri = vsCodeUriToUriString(vsCodeUri)
    knownFlixFiles.add(uri)
    client.sendNotification(jobs.Request.apiAddUri, { uri })
    scheduleReconciliation(client)
  })

  // A package or JAR is never handed to the compiler: it loads the ones the manifest declares
  // itself. A change to one of them is reported as a restart, which loads the project again.
  // Rebuilding a package overwrites it in place, which is a change rather than a creation.
  const sendRestart = () => client.sendNotification(jobs.Request.apiRestart)

  pkgWatcher = vscode.workspace.createFileSystemWatcher(getFpkgGlobPattern())
  pkgWatcher.onDidCreate(sendRestart)
  pkgWatcher.onDidChange(sendRestart)
  pkgWatcher.onDidDelete(sendRestart)

  jarWatcher = vscode.workspace.createFileSystemWatcher(getJarGlobPattern())
  jarWatcher.onDidCreate(sendRestart)
  jarWatcher.onDidChange(sendRestart)
  jarWatcher.onDidDelete(sendRestart)

  // The manifest is watched for creation and deletion too, not only for change: it is what makes a
  // folder of loose files a project, and back. It joins the packages and JARs above rather than
  // asking first, since loading the project is what resolves the dependencies it declares — the
  // same grouping the plain LSP server watches.
  //
  // The REPL is rebooted alongside the restart: it resolves the dependencies of the manifest when
  // it is launched, so a running one keeps serving the ones it started with. Only the manifest
  // reboots it. Loading the project installs what it resolves into `lib/`, so rebooting on the
  // packages and JARs as well would restart the REPL again for every dependency just installed.
  const onManifestChange = () => {
    sendRestart()
    scheduleReplReboot(onRestartRepl)
  }

  tomlWatcher = vscode.workspace.createFileSystemWatcher(getFlixTomlGlobPattern())
  tomlWatcher.onDidCreate(onManifestChange)
  tomlWatcher.onDidChange(onManifestChange)
  tomlWatcher.onDidDelete(onManifestChange)

  // Watch for folder-level deletions/creations (e.g. deleting src/) that
  // the file-specific watchers above don't catch.
  vscode.workspace.onDidDeleteFiles(() => scheduleReconciliation(client))
  vscode.workspace.onDidCreateFiles(() => scheduleReconciliation(client))
}

/**
 * Set up document tracking for single-file mode.
 * Tracks document open/close to add/remove .flix files from the compiler.
 * Content changes are already handled by the LSP TextDocumentSync mechanism.
 */
export function setupSingleFileTracking(client: LanguageClient) {
  vscode.workspace.onDidOpenTextDocument(doc => {
    if (doc.uri.path.endsWith('.flix')) {
      client.sendNotification(jobs.Request.apiAddUri, { uri: vsCodeUriToUriString(doc.uri) })
    }
  })
  vscode.workspace.onDidCloseTextDocument(doc => {
    if (doc.uri.path.endsWith('.flix')) {
      client.sendNotification(jobs.Request.apiRemUri, { uri: vsCodeUriToUriString(doc.uri) })
    }
  })
}

/**
 * Discover the source files of the workspace and update the known file set.
 * In project mode, uses workspace glob patterns.
 * In single-file mode, uses currently open .flix documents.
 *
 * Only the source files are discovered: the compiler loads the packages and JARs of the project
 * itself, from the manifest.
 */
export async function discoverWorkspaceFiles(): Promise<string[]> {
  if (isProjectMode()) {
    const workspaceFiles = (await vscode.workspace.findFiles(getFlixGlobPattern())).map(vsCodeUriToUriString)
    knownFlixFiles = new Set(workspaceFiles)
    return workspaceFiles
  } else {
    const workspaceFiles = vscode.workspace.textDocuments
      .filter(doc => doc.uri.path.endsWith('.flix'))
      .map(doc => vsCodeUriToUriString(doc.uri))
    knownFlixFiles = new Set(workspaceFiles)
    return workspaceFiles
  }
}

/**
 * Dispose all file system watchers and clear the reconciliation timer.
 */
export function disposeWatchers() {
  flixWatcher && flixWatcher.dispose()
  pkgWatcher && pkgWatcher.dispose()
  jarWatcher && jarWatcher.dispose()
  tomlWatcher && tomlWatcher.dispose()
  if (reconcileTimer !== undefined) {
    clearTimeout(reconcileTimer)
  }
  if (replRebootTimer !== undefined) {
    clearTimeout(replRebootTimer)
    replRebootTimer = undefined
  }
}
