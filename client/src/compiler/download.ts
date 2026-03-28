import * as path from 'path'
import * as fs from 'fs'
import * as vscode from 'vscode'

import { download, fetchRelease, firstNewerThanSecond, FlixRelease } from './releases'
import { openFlixReleaseOverview } from '../ui/releaseNotes'
import { getInstalledFlixVersion, setInstalledFlixVersion } from './installedVersion'
import { USER_MESSAGE } from '../ui/messages'

const FLIX_JAR = 'flix.jar'
const FLIX_JAR_NEW = 'flix.jar.new'

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
 * If a staged `flix.jar.new` exists from a previous download, move it into
 * place. This runs before the JVM starts, so the file is not locked.
 */
async function applyPendingUpdate(globalStoragePath: string): Promise<void> {
  const pendingFile = path.join(globalStoragePath, FLIX_JAR_NEW)
  if (!fs.existsSync(pendingFile)) {
    return
  }

  const targetFile = path.join(globalStoragePath, FLIX_JAR)
  try {
    // Node.js fs.rename on Windows does NOT atomically replace an existing
    // file, so we must unlink first. Safe here because the JVM hasn't started.
    await fs.promises.unlink(targetFile).catch(err => {
      if (err.code !== 'ENOENT') {
        throw err
      }
    })
    await fs.promises.rename(pendingFile, targetFile)
    // Show the changelog that was deferred from the download.
    const installedVersion = getInstalledFlixVersion()
    if (installedVersion) {
      openFlixReleaseOverview(installedVersion)
    }
  } catch (err) {
    console.warn('Failed to apply pending flix.jar update, will retry on next startup:', err)
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
 * @param workspaceFolders Workspace folder paths. Empty in single-file mode
 *   (no folder open), in which case step 1 is skipped.
 */
export default async function ensureFlixExists({
  globalStoragePath,
  workspaceFolders = [],
  shouldUpdateFlix,
}): Promise<string | undefined> {
  // Apply any pending update downloaded in a previous session.
  await applyPendingUpdate(globalStoragePath)

  if (!shouldUpdateFlix) {
    // 1. If `flix.jar` exists in any workspace folder, use that
    // In single-file mode workspaceFolders is [], so this loop is skipped.
    for (const folder of workspaceFolders) {
      const filename = path.join(folder, FLIX_JAR)
      if (fs.existsSync(filename)) {
        return filename
      }
    }
    // 2. If `flix.jar` exists in `globalStoragePath`, use that
    const filename = path.join(globalStoragePath, FLIX_JAR)
    const installedFlixRelease = getInstalledFlixVersion()
    if (fs.existsSync(filename) && installedFlixRelease) {
      const sixHoursInMilliseconds = 1000 * 60 * 60 * 6

      // skip if we checked under 6 hours ago
      if (Date.now() < (installedFlixRelease.downloadedAt || 0) + sixHoursInMilliseconds) {
        return filename
      }

      // Check if a newer version is available
      try {
        const flixRelease = await fetchRelease()
        // Give the user the option to update if there's a newer version available
        if (firstNewerThanSecond(flixRelease, installedFlixRelease)) {
          const { msg, option1, option2 } = USER_MESSAGE.ASK_DOWNLOAD_NEW_FLIX(flixRelease.name)
          const updateResponse = await vscode.window.showInformationMessage(msg, option1, option2)
          if (updateResponse === 'Download') {
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
            return undefined
          }
        }
      } catch (error) {
        // If the fetch request fails, we simply do not check for a new version of the compiler.
        // Since the extension can still work, avoid bothering the user.
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
