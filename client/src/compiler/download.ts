import * as path from 'path'
import * as fs from 'fs'
import * as vscode from 'vscode'

import { download, fetchRelease, FlixRelease } from './releases'
import { getLastUpdateCheck, setLastUpdateCheck, setReleaseNotes } from './globalState'
import { showNewReleaseNotes } from '../ui/releaseNotes'
import { USER_MESSAGE } from '../ui/messages'
import { compareSemVer, parseSemVer, SemVer, showSemVer } from '../util/semVer'

/**
 * The name of a compiler which the user has put in a workspace folder.
 */
const WORKSPACE_JAR = 'flix.jar'

/**
 * The name under which a downloaded compiler is stored in global storage: `flix-X.Y.Z.jar`, where
 * `X.Y.Z` is a semantic version, so its numbers have no leading zeros.
 *
 * Every version has a file of its own, and a file under such a name is never replaced or deleted.
 * A running compiler or REPL holds its jar open, which on Windows keeps the file from being
 * replaced or deleted, so installing a compiler must never depend on getting rid of another one.
 *
 * Anything else in global storage is ignored, whatever it is called: a download which is still
 * staged, the `flix.jar` and `flix.jar.new` of the layout which came before this one, and any
 * other file, e.g. `flix-garbage`, `flix-0.90.jar` or `flix-0.090.0.jar`.
 */
const VERSIONED_JAR = /^flix-((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))\.jar$/

/**
 * How long GitHub is left alone after it has told us what the latest release is.
 */
const UPDATE_CHECK_INTERVAL_MS = 1000 * 60 * 60 * 6

/**
 * A compiler in global storage.
 */
interface FlixJar {
  filename: string
  version: SemVer
}

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
 * Returns the path under which the compiler with the given `version` is stored.
 */
function versionedJarPath(globalStoragePath: string, version: SemVer): string {
  return path.join(globalStoragePath, `flix-${showSemVer(version)}.jar`)
}

/**
 * Returns the compiler with the highest version in global storage, if it holds one.
 *
 * Which compilers are installed is not recorded anywhere else: the filenames are the record.
 * Whatever is not a file with exactly the name of a compiler is passed over.
 */
function findHighestJar(globalStoragePath: string): FlixJar | undefined {
  // Global storage does not exist until the first compiler is downloaded.
  const entries = fs.existsSync(globalStoragePath) ? fs.readdirSync(globalStoragePath, { withFileTypes: true }) : []

  const jars: FlixJar[] = []
  for (const entry of entries) {
    const version = parseSemVer(VERSIONED_JAR.exec(entry.name)?.[1] ?? '')
    if (version !== undefined && entry.isFile()) {
      jars.push({ filename: path.join(globalStoragePath, entry.name), version })
    }
  }
  return jars.sort((jar1, jar2) => compareSemVer(jar2.version, jar1.version))[0]
}

/**
 * Asks GitHub for the latest release, and records when it answered.
 */
async function fetchLatestRelease(): Promise<FlixRelease> {
  const release = await fetchRelease()
  await setLastUpdateCheck(Date.now())
  return release
}

/**
 * Downloads the compiler of the given `release` into global storage, under its version.
 *
 * This is the only place a compiler is downloaded. The jar gets a name no other version has, so
 * nothing which is running is in its way, whichever compiler it runs on.
 *
 * The release notes are stored, to be shown when a session first starts on the compiler.
 */
async function downloadRelease(globalStoragePath: string, release: FlixRelease): Promise<FlixJar> {
  const filename = versionedJarPath(globalStoragePath, release.version)

  await fs.promises.mkdir(globalStoragePath, { recursive: true })
  await download({
    url: release.downloadUrl,
    dest: filename,
    progressTitle: USER_MESSAGE.INFORM_DOWNLOAD_FLIX(),
  })
  await setReleaseNotes({ version: release.version, description: release.description, shown: false })

  return { filename, version: release.version }
}

/**
 * Returns the compiler to start on, given that `installed` is the highest one in global storage:
 * the latest release if it is newer and the user wants it, and `installed` otherwise.
 *
 * Only to be called at the start of a session. Nothing is running yet at that point, so a compiler
 * which is downloaded here is simply the one the session starts on: no reload is needed.
 *
 * @param askBeforeUpdate Whether the user is asked before a newer release is downloaded.
 */
async function updateFlix(globalStoragePath: string, installed: FlixJar, askBeforeUpdate: boolean): Promise<FlixJar> {
  // Skip the update check if we checked under 6 hours ago
  if (Date.now() < getLastUpdateCheck() + UPDATE_CHECK_INTERVAL_MS) {
    return installed
  }

  try {
    const release = await fetchLatestRelease()
    if (compareSemVer(release.version, installed.version) <= 0) {
      return installed
    }

    // Give the user the option to update if there's a newer version available
    if (askBeforeUpdate) {
      const { msg, option1, option2 } = USER_MESSAGE.ASK_DOWNLOAD_NEW_FLIX(release.name)
      const updateResponse = await vscode.window.showInformationMessage(msg, option1, option2)
      if (updateResponse !== option1) {
        return installed
      }
    }

    return await downloadWithRetryDialog(() => downloadRelease(globalStoragePath, release))
  } catch (error) {
    // If the fetch request fails, we simply do not check for a new version of the compiler, and if
    // the download fails, we start on the compiler we have.
    // Since the extension can still work, avoid bothering the user.
    return installed
  }
}

/**
 * Prompts the user to reload the window so the newly downloaded compiler
 * takes effect. Does not block — if the user dismisses the prompt, the
 * compiler is picked up the next time the window loads.
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
 * Downloads the latest release of the compiler, unless it is in global storage already.
 *
 * The compiler and the REPLs of the window keep running on the jar they were started from: the
 * new jar is a file of its own. A session chooses its compiler when the window loads, so a reload
 * is offered, after which the new jar is the highest one and therefore the one started.
 */
export async function downloadLatestFlix(globalStoragePath: string): Promise<void> {
  const release = await downloadWithRetryDialog(fetchLatestRelease)

  if (fs.existsSync(versionedJarPath(globalStoragePath, release.version))) {
    vscode.window.showInformationMessage(USER_MESSAGE.INFORM_ALREADY_DOWNLOADED(release.name))
    return
  }

  await downloadWithRetryDialog(() => downloadRelease(globalStoragePath, release))
  promptReloadForUpdate()
}

/**
 * Ensures that a compiler is available, returning the path of its jar.
 *
 * Resolution order:
 *   1. `flix.jar` in any workspace folder (skipped in single-file mode)
 *   2. The highest `flix-X.Y.Z.jar` in `globalStoragePath`, or the latest release if it is newer
 *      and the user wants it
 *   3. Download from GitHub
 *
 * Only to be called at the start of a session. The jar it returns is the one the compiler and
 * every REPL of the session are launched from, so that they all run the same version.
 *
 * @param workspaceFolders Workspace folder paths. Empty in single-file mode
 *   (no folder open), in which case step 1 is skipped.
 * @param askBeforeUpdate Whether the user is asked before a newer release is downloaded in step 2.
 * @throws if there is no compiler and none can be downloaded.
 */
export default async function ensureFlixExists({
  globalStoragePath,
  workspaceFolders = [],
  askBeforeUpdate,
}: {
  globalStoragePath: string
  workspaceFolders?: string[]
  askBeforeUpdate: boolean
}): Promise<string> {
  // 1. If `flix.jar` exists in any workspace folder, use that
  // In single-file mode workspaceFolders is [], so nothing is found.
  const workspaceJar = workspaceFolders
    .map(folder => path.join(folder, WORKSPACE_JAR))
    .find(filename => fs.existsSync(filename))
  if (workspaceJar) {
    return workspaceJar
  }

  // 2. If a compiler exists in `globalStoragePath`, use the highest one, or a newer release
  // 3. Otherwise download the latest release into `globalStoragePath`
  const installed = findHighestJar(globalStoragePath)
  const jar = installed
    ? await updateFlix(globalStoragePath, installed, askBeforeUpdate)
    : await downloadWithRetryDialog(async () => downloadRelease(globalStoragePath, await fetchLatestRelease()))

  await showNewReleaseNotes(jar.version)

  return jar.filename
}
