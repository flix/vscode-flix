import * as path from 'path'
import * as fs from 'fs'
import * as vscode from 'vscode'

import { download, fetchRelease, firstNewerThanSecond, FlixRelease } from './releases'
import { openFlixReleaseOverview } from '../ui/releaseNotes'
import { getInstalledFlixVersion, setInstalledFlixVersion } from './installedVersion'
import { USER_MESSAGE } from '../ui/messages'

const FLIX_JAR = 'flix.jar'
const FLIX_JAR_NEW = 'flix.jar.new'

/**
 * The error codes with which Windows refuses to delete or replace a file that another process
 * holds open.
 */
const FILE_LOCK_ERROR_CODES = ['EBUSY', 'EPERM', 'EACCES']

/**
 * How many times replacing a locked `flix.jar` is attempted, and how long is waited in between,
 * before the user is asked: five seconds in all.
 */
const REPLACE_JAR_ATTEMPTS = 20
const REPLACE_JAR_RETRY_DELAY_MS = 250

async function downloadWithRetryDialog<T>(downloadFunc: () => Promise<T>): Promise<T> {
  while (true) {
    try {
      return await downloadFunc()
    } catch (e) {
      const { msg, option1, option2 } = USER_MESSAGE.ASK_DOWNLOAD_RETRY(e.message)
      const selected = await vscode.window.showErrorMessage(
        msg,
        {},
        { title: option1, retry: true },
        { title: option2 },
      )

      if (selected?.retry) {
        continue
      }
      throw e
    }
  }
}

/**
 * Moves the staged `pendingFile` into the place of `targetFile`.
 *
 * On Windows this fails with EBUSY / EPERM / EACCES for as long as a JVM process (e.g. a Flix
 * REPL) holds the jar open. `releaseFlixJar` ends the processes we know of, but it only asks for
 * them to be killed: they let go of the jar a moment later. A REPL terminal which VS Code revives
 * from an earlier session can also show up, and open the jar, after the first sweep. A locked jar
 * is therefore released and tried again for a few seconds before the failure is passed on.
 */
async function replaceFlixJar(pendingFile: string, targetFile: string, releaseFlixJar: () => void): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    releaseFlixJar()
    try {
      // Node.js fs.rename on Windows does NOT atomically replace an existing
      // file, so we must unlink first.
      await fs.promises.unlink(targetFile).catch(err => {
        if (err.code !== 'ENOENT') {
          throw err
        }
      })
      await fs.promises.rename(pendingFile, targetFile)
      return
    } catch (err) {
      if (attempt >= REPLACE_JAR_ATTEMPTS || !FILE_LOCK_ERROR_CODES.includes(err.code)) {
        throw err
      }
      await new Promise(resolve => setTimeout(resolve, REPLACE_JAR_RETRY_DELAY_MS))
    }
  }
}

/**
 * If a staged `flix.jar.new` exists from a previous download, move it into
 * place.
 *
 * The jar cannot be replaced on Windows while a JVM process holds it open, so
 * `releaseFlixJar` is called to end those processes: before the first attempt,
 * and again whenever the jar turns out to be locked. If the lock persists we
 * show a retry dialog so the user can close the process manually.
 *
 * @param releaseFlixJar Ends the processes which hold `flix.jar` open, i.e. disposes the REPLs.
 */
async function applyPendingUpdate(globalStoragePath: string, releaseFlixJar: () => void): Promise<void> {
  const pendingFile = path.join(globalStoragePath, FLIX_JAR_NEW)
  const targetFile = path.join(globalStoragePath, FLIX_JAR)

  // Looked for again on every retry: once the staged jar is gone there is nothing left to apply,
  // and trying anyway would only delete the jar which is in place.
  while (fs.existsSync(pendingFile)) {
    try {
      await replaceFlixJar(pendingFile, targetFile, releaseFlixJar)
      // Show the changelog that was deferred from the download.
      const installedVersion = getInstalledFlixVersion()
      if (installedVersion) {
        openFlixReleaseOverview(installedVersion)
      }
      return
    } catch (err) {
      const { msg, option1, option2 } = USER_MESSAGE.ASK_APPLY_UPDATE_RETRY(targetFile)
      const selected = await vscode.window.showErrorMessage(msg, option1, option2)
      if (selected === option1) {
        continue
      }
      return
    }
  }
}

/**
 * Prompts the user to reload the window so the newly downloaded compiler
 * takes effect. Does not block — if the user dismisses the prompt, the
 * update is applied on the next window reload / restart.
 */
function promptReloadForUpdate() {
  const { msg, option1 } = USER_MESSAGE.ASK_RELOAD_FOR_UPDATE()
  vscode.window.showInformationMessage(msg, option1).then(selected => {
    if (selected === option1) {
      vscode.commands.executeCommand('workbench.action.reloadWindow')
    }
  })
}

/**
 * Offers the user the newer `flixRelease`. If they accept, downloads it to a
 * staged `flix.jar.new` (so we don't disturb the jar the running compiler may
 * have locked), records it as the installed version, and prompts a reload.
 *
 * @returns `true` if a new version was staged — the caller should skip engine
 *   startup and let the update apply on the next reload; `false` if the user
 *   declined.
 */
async function offerUpdate(globalStoragePath: string, flixRelease: FlixRelease): Promise<boolean> {
  const { msg, option1, option2 } = USER_MESSAGE.ASK_DOWNLOAD_NEW_FLIX(flixRelease.name)
  const updateResponse = await vscode.window.showInformationMessage(msg, option1, option2)
  if (updateResponse !== option1) {
    return false
  }

  const stagingFilename = path.join(globalStoragePath, FLIX_JAR_NEW)
  await downloadWithRetryDialog(async () => {
    await download({
      url: flixRelease.downloadUrl,
      dest: stagingFilename,
      progressTitle: USER_MESSAGE.INFORM_DOWNLOAD_FLIX(),
      overwrite: true,
    })
    await setInstalledFlixVersion(flixRelease, { showChangelog: false })
  })
  promptReloadForUpdate()
  return true
}

/**
 * Returns the path of the `flix.jar` in the first workspace folder which has one, if any.
 */
function findWorkspaceFlixJar(workspaceFolders: string[]): string | undefined {
  return workspaceFolders.map(folder => path.join(folder, FLIX_JAR)).find(filename => fs.existsSync(filename))
}

/**
 * Returns the path of the `flix.jar` which is on disk, or `undefined` if there is none.
 *
 * It looks in the places {@linkcode ensureFlixExists} does, in the same order, but it only looks:
 * no pending update is applied, no newer version is offered and nothing is downloaded. All of that
 * belongs to the start of a session, before the compiler has opened the jar. This is the one to
 * call while a session is running, e.g. to launch a REPL.
 *
 * @param shouldUpdateFlix Whether the session was started by downloading a compiler. One is always
 *   downloaded into `globalStoragePath`, so the workspace folders are passed over.
 */
export function findFlixJar({ globalStoragePath, workspaceFolders = [], shouldUpdateFlix }): string | undefined {
  if (!shouldUpdateFlix) {
    const workspaceJar = findWorkspaceFlixJar(workspaceFolders)
    if (workspaceJar) {
      return workspaceJar
    }
  }
  const filename = path.join(globalStoragePath, FLIX_JAR)
  return fs.existsSync(filename) ? filename : undefined
}

/**
 * Ensures that `flix.jar` is available, returning its path.
 *
 * Returns `undefined` when a new compiler was staged as `flix.jar.new` and a
 * window reload is needed — the caller should skip engine startup in that case.
 *
 * Resolution order:
 *   1. `flix.jar` in any workspace folder (skipped in single-file mode)
 *   2. `flix.jar` in `globalStoragePath`
 *   3. Download from GitHub
 *
 * Only to be called at the start of a session: it replaces and downloads the jar, which a running
 * compiler or REPL holds open. Use {@linkcode findFlixJar} to merely locate it.
 *
 * @param workspaceFolders Workspace folder paths. Empty in single-file mode
 *   (no folder open), in which case step 1 is skipped.
 * @param releaseFlixJar Ends the processes which hold `flix.jar` open, i.e. disposes the REPLs.
 *   Called before a pending update is applied.
 */
export default async function ensureFlixExists({
  globalStoragePath,
  workspaceFolders = [],
  shouldUpdateFlix,
  releaseFlixJar,
}): Promise<string | undefined> {
  // Apply any pending update downloaded in a previous session.
  await applyPendingUpdate(globalStoragePath, releaseFlixJar)

  if (!shouldUpdateFlix) {
    // 1. If `flix.jar` exists in any workspace folder, use that
    // In single-file mode workspaceFolders is [], so nothing is found.
    const workspaceJar = findWorkspaceFlixJar(workspaceFolders)
    if (workspaceJar) {
      return workspaceJar
    }
    // 2. If `flix.jar` exists in `globalStoragePath`, use that
    const filename = path.join(globalStoragePath, FLIX_JAR)
    if (fs.existsSync(filename)) {
      // Only check for a newer version when we know which version is installed.
      // Without this metadata we cannot compare versions, so we use the existing
      // jar as-is instead of re-downloading it. This notably happens in the test
      // environment, where the Memento is reset between runs (making
      // `getInstalledFlixVersion()` return `undefined`) even though the jar on
      // disk persists — the old behaviour re-staged `flix.jar.new` and prompted a
      // reload on every run, hanging the test suite.
      const installedFlixRelease = getInstalledFlixVersion()
      if (installedFlixRelease) {
        const sixHoursInMilliseconds = 1000 * 60 * 60 * 6

        // skip the update check if we checked under 6 hours ago
        if (Date.now() >= (installedFlixRelease.downloadedAt || 0) + sixHoursInMilliseconds) {
          // Check if a newer version is available
          try {
            const flixRelease = await fetchRelease()
            // Give the user the option to update if there's a newer version available
            if (firstNewerThanSecond(flixRelease, installedFlixRelease)) {
              const staged = await offerUpdate(globalStoragePath, flixRelease)
              if (staged) {
                return undefined
              }
            }
          } catch (error) {
            // If the fetch request fails, we simply do not check for a new version of the compiler.
            // Since the extension can still work, avoid bothering the user.
          }
        }
      }

      return filename
    }
  }
  // 3. Otherwise download into `globalStoragePath` (create folder if necessary)
  const filename = path.join(globalStoragePath, FLIX_JAR)

  if (!fs.existsSync(globalStoragePath)) {
    fs.mkdirSync(globalStoragePath)
  }

  // If flix.jar already exists (and may be locked by the JVM), stage the
  // download as flix.jar.new so we don't hit a file-lock error on Windows.
  const flixJarExists = fs.existsSync(filename)
  const downloadDest = flixJarExists ? path.join(globalStoragePath, FLIX_JAR_NEW) : filename

  await downloadWithRetryDialog(async () => {
    const flixRelease = await fetchRelease()
    await download({
      url: flixRelease.downloadUrl,
      dest: downloadDest,
      progressTitle: USER_MESSAGE.INFORM_DOWNLOAD_FLIX(),
      overwrite: true,
    })
    await setInstalledFlixVersion(flixRelease, { showChangelog: !flixJarExists })
  })

  if (flixJarExists && downloadDest !== filename) {
    promptReloadForUpdate()
    return undefined
  }

  return filename
}
