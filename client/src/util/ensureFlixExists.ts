import * as path from 'path'
import * as fs from 'fs'
import * as vscode from 'vscode'

import { download, fetchRelease, firstNewerThanSecond, FlixRelease } from '../services/releases'
import { getInstalledFlixVersion, setInstalledFlixVersion } from '../services/state'
import { USER_MESSAGE } from './userMessages'

const FLIX_JAR = 'flix.jar'

async function downloadWithRetryDialog<T>(downloadFunc: () => Promise<T>): Promise<T> {
  try {
    return await downloadFunc()
  } catch (e) {
    const { msg, option1, option2 } = USER_MESSAGE.ASK_DOWNLOAD_RETRY(e.message)
    const selected = await vscode.window.showErrorMessage(msg, {}, { title: option1, retry: true }, { title: option2 })

    if (selected?.retry) {
      downloadWithRetryDialog(downloadFunc)
    }
    throw e
  }
}

export default async function ensureFlixExists({ globalStoragePath, workspaceFolders, shouldUpdateFlix }) {
  if (!shouldUpdateFlix) {
    // 1. If `flix.jar` exists in any workspace folder, use that
    for (const folder of workspaceFolders) {
      const filename = path.join(folder, FLIX_JAR)
      if (fs.existsSync(filename)) {
        return filename
      }
    }
    // 2. If `flix.jar` exists in `globalStoragePath`, use that
    const filename = path.join(globalStoragePath, FLIX_JAR)
    if (fs.existsSync(filename)) {
      const installedFlixRelease: FlixRelease = getInstalledFlixVersion()
      const thirtyMinutesInMilliseconds = 1000 * 60 * 30

      // skip if we checked under 30 minutes ago
      if (Date.now() < (installedFlixRelease.downloadedAt || 0) + thirtyMinutesInMilliseconds) {
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
            await downloadWithRetryDialog(async () => {
              await download({
                url: flixRelease.downloadUrl,
                dest: filename,
                progressTitle: USER_MESSAGE.INFORM_DOWNLOAD_FLIX(),
                overwrite: true,
              })
              await setInstalledFlixVersion(flixRelease)
            })
          }
        }
      } catch (error) {
        // If the fetch request fails, we simply do not check for a new version of the compiler.
        // Since the extension can still work, avoid bothering the user.
      }
      return filename
    }
  }
  // 3. Otherwise download `FLIX_URL` into `globalStoragePath` (create folder if necessary)
  const filename = path.join(globalStoragePath, FLIX_JAR)

  if (!fs.existsSync(globalStoragePath)) {
    fs.mkdirSync(globalStoragePath)
  }

  await downloadWithRetryDialog(async () => {
    const flixRelease = await fetchRelease()
    await download({
      url: flixRelease.downloadUrl,
      dest: filename,
      progressTitle: USER_MESSAGE.INFORM_DOWNLOAD_FLIX(),
      overwrite: true,
    })
    await setInstalledFlixVersion(flixRelease)
  })

  return filename
}
