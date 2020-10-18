import * as path from 'path'
import * as fs from 'fs'
import * as vscode from 'vscode'

import { download, fetchReleaseWithFallback, firstNewerThanSecond, FlixRelease } from '../services/releases'
import { getInstalledFlixVersion, setInstalledFlixVersion } from '../services/state'

const FLIX_JAR = 'flix.jar'

async function downloadWithRetryDialog<T>(downloadFunc: () => Promise<T>): Promise<T> {
  while (true) {
    try {
      return await downloadFunc()
    } catch (e) {
      const selected = await vscode.window.showErrorMessage("Failed to download: " + e.message, {}, {
        title: "Retry download",
        retry: true,
      }, {
        title: "Dismiss",
      })

      if (selected?.retry) {
        continue
      }
      throw e
    }
  }
}

export default async function ensureFlixExists ({ globalStoragePath, workspaceFolders, shouldUpdateFlix }) {
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
      // Check if a newer version is available
      const flixRelease = await fetchReleaseWithFallback()
      const installedFlixRelease: FlixRelease = getInstalledFlixVersion()
      // Give the user the option to update if there's a newer version available
      if (firstNewerThanSecond(flixRelease, installedFlixRelease)) {
        const updateResponse = await vscode.window.showInformationMessage(
          `A new version of the Flix compiler (${flixRelease.name}) is available. Download?`,
          'Download',
          'Skip'
        )
        if (updateResponse === 'Download') {
          await downloadWithRetryDialog(async () => {
            await download({
              url: flixRelease.downloadUrl,
              dest: filename,
              progressTitle: 'Downloading Flix Compiler',
              overwrite: true
            })
            await setInstalledFlixVersion(flixRelease)
          })
        }
      }
      
      return filename
    }
  }
  // 3. Otherwise download `FLIX_URL` into `globalStoragePath` (create folder if necessary)
  const filename = path.join(globalStoragePath, FLIX_JAR)
    
  if (!fs.existsSync(globalStoragePath)) {
    fs.mkdirSync(globalStoragePath)
  }

  const userResponse = await vscode.window.showInformationMessage(
    'This plugin requires the Flix compiler. Do you want to download it now?',
    'Download'
  )

  if (userResponse !== 'Download') {
    throw new Error('User refused download. Cannot continue.')
  }

  await downloadWithRetryDialog(async () => {
    const flixRelease = await fetchReleaseWithFallback()
    await download({
      url: flixRelease.downloadUrl,
      dest: filename,
      progressTitle: 'Downloading Flix Compiler',
      overwrite: true
    })
    await setInstalledFlixVersion(flixRelease)
  })

  return filename
}
