// NOTE: This is copied (and adjusted) from:
// https://github.com/rust-analyzer/rust-analyzer/blob/master/editors/code/src/net.ts
// The code in rust-analyzer is released under the same licence as this project.

import * as vscode from 'vscode'
import * as stream from 'stream'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as zlib from 'zlib'
import * as util from 'util'
import { strict as nativeAssert } from 'assert'
import { parseSemVer, SemVer } from '../util/semVer'

const pipeline = util.promisify(stream.pipeline)

const GITHUB_API_ENDPOINT_URL = 'https://api.github.com'
const OWNER = 'flix'
const REPO = 'flix'

export function assert(condition: boolean, explanation: string): asserts condition {
  try {
    nativeAssert(condition, explanation)
  } catch (err) {
    console.error('Assertion failed:', explanation)
    throw err
  }
}

export async function fetchRelease(
  releaseTag: string = 'latest',
  githubToken?: string | null | undefined,
): Promise<FlixRelease> {
  const apiEndpointPath = `/repos/${OWNER}/${REPO}/releases/${releaseTag}`

  const requestUrl = GITHUB_API_ENDPOINT_URL + apiEndpointPath

  console.warn('Issuing request for released artifacts metadata to', requestUrl)

  const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' }
  if (githubToken !== null && githubToken !== undefined) {
    headers.Authorization = 'token ' + githubToken
  }

  const response = await fetch(requestUrl, { headers: headers })

  if (!response.ok) {
    console.error('Error fetching artifact release info', {
      requestUrl,
      releaseTag,
      response: {
        headers: response.headers,
        status: response.status,
        body: await response.text(),
      },
    })

    throw new Error(`Got response ${response.status} when trying to fetch ` + `release info for ${releaseTag} release`)
  }

  // We skip runtime type checks for simplicity (here we cast from `unknown` to `GithubRelease`)
  const release = (await response.json()) as GithubRelease
  const flixRelease: FlixRelease = {
    url: release.url,
    name: release.name,
    description: release.body,
    version: tagToVersion(release.tag_name),
    downloadUrl: release.assets[0].browser_download_url,
  }
  return flixRelease
}

/**
 * Returns the version which the given tag of a release names, e.g. 0.81.0 for `v0.81.0`.
 *
 * @throws if the tag does not name a version. The compiler of a release is stored under its
 *   version, so a release without one cannot be installed.
 */
function tagToVersion(tagName: string = ''): SemVer {
  const version = parseSemVer(tagName[0] === 'v' ? tagName.slice(1) : tagName)
  if (version === undefined) {
    throw new Error(`The release tag '${tagName}' is not a version`)
  }
  return version
}

export interface FlixRelease {
  url: string
  name: string
  description: string
  version: SemVer
  downloadUrl: string
}

// We omit declaration of tremendous amount of fields that we are not using here
interface GithubRelease {
  url: string
  name: string
  id: number
  body: string
  tag_name: string
  published_at: string
  assets: Array<{
    name: string
    browser_download_url: string
  }>
}

interface DownloadOpts {
  progressTitle: string
  url: string
  dest: string
  mode?: number
  gunzip?: boolean
}

/**
 * Downloads the artifact at `opts.url` to the file `opts.dest`, unless that file exists by the time
 * the download is complete: a file which is in place is never replaced.
 */
export async function download(opts: DownloadOpts) {
  // Stage the artifact in a file of its own (in the same dir for simplicity), `<dest>.<random>.new`,
  // to prevent partially downloaded files when user kills vscode. The random part keeps two windows
  // which download the same artifact at once from writing to the same file.
  const randomHex = crypto.randomBytes(5).toString('hex')
  const tempFile = `${opts.dest}.${randomHex}.new`

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      cancellable: false,
      title: opts.progressTitle,
    },
    async (progress, _cancellationToken) => {
      let lastPercentage = 0
      await downloadFile(opts.url, tempFile, opts.mode, !!opts.gunzip, (readBytes, totalBytes) => {
        const newPercentage = (readBytes / totalBytes) * 100
        progress.report({
          message: newPercentage.toFixed(0) + '%',
          increment: newPercentage - lastPercentage,
        })

        lastPercentage = newPercentage
      })
    },
  )

  // Another window may have completed the same download in the meantime. Its file is the same as
  // ours, and a process may already hold it open, which keeps it from being replaced on Windows.
  if (fs.existsSync(opts.dest)) {
    await fs.promises.unlink(tempFile)
  } else {
    await fs.promises.rename(tempFile, opts.dest)
  }
}

async function downloadFile(
  url: string,
  destFilePath: fs.PathLike,
  mode: number | undefined,
  gunzip: boolean,
  onProgress: (readBytes: number, totalBytes: number) => void,
): Promise<void> {
  const res = await fetch(url)

  if (!res.ok) {
    console.error('Error', res.status, 'while downloading file from', url)
    console.error({ body: await res.text(), headers: res.headers })

    throw new Error(`Got response ${res.status} when trying to download a file.`)
  }

  const totalBytes = Number(res.headers.get('content-length'))
  assert(!Number.isNaN(totalBytes), 'Sanity check of content-length protocol')

  console.warn('Downloading file of', totalBytes, 'bytes size from', url, 'to', destFilePath)

  // The fetch API uses the ReadableStream from 'stream/web'
  // Convert it the the native one
  const bodyStream = stream.Readable.fromWeb(res.body)

  let readBytes = 0
  bodyStream.on('data', (chunk: Buffer) => {
    readBytes += chunk.length
    onProgress(readBytes, totalBytes)
  })

  const destFileStream = fs.createWriteStream(destFilePath, { mode })
  const srcStream = gunzip ? bodyStream.pipe(zlib.createGunzip()) : bodyStream

  await pipeline(srcStream, destFileStream)

  // Don't apply the workaround in fixed versions of nodejs, since the process
  // freezes on them, the process waits for no-longer emitted `close` event.
  // The fix was applied in commit 7eed9d6bcc in v13.11.0
  // See the nodejs changelog:
  // https://github.com/nodejs/node/blob/master/doc/changelogs/CHANGELOG_V13.md
  const [, major, minor] = /v(\d+)\.(\d+)\.(\d+)/.exec(process.version)!
  if (+major > 13 || (+major === 13 && +minor >= 11)) {
    return
  }

  await new Promise<void>(resolve => {
    destFileStream.on('close', resolve)
    destFileStream.destroy()
    // This workaround is awaiting to be removed when vscode moves to newer nodejs version:
    // https://github.com/rust-analyzer/rust-analyzer/issues/3167
  })
}
