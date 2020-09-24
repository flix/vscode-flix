const { https } = require('follow-redirects')
const fs = require('fs')
const path = require('path')

const FLIX_URL = 'https://flix.dev/nightly/flix-2020-09-24.jar'
const FLIX_JAR = 'flix.jar'

interface DownloadFileInput {
  url: string
  targetFile: string
}

interface DownloadFlixInput {
  workspaceFolders: [string],
  globalStoragePath: string,
  shouldUpdateFlix?: boolean
}

interface DownloadFlixResult {
  filename: string
}

const downloadFile = ({ url, targetFile }: DownloadFileInput) => new Promise((resolve, reject) => {
  try {
    https.get(url, (response: any) => {
      response.pipe(targetFile)
      response.on('close', resolve)
      response.on('error', reject)
    })
  } catch (err) {
    reject(err)
  }
})

/**
 * Download Flix compiler when necessary.
 * 
 * 1. If `flix.jar` exists in any workspace folder, use that (skipped if shouldUpdateFlix)
 * 2. If `flix.jar` exists in `globalStoragePath`, use that (skipped if shouldUpdateFlix)
 * 3. Otherwise download `FLIX_URL` into `globalStoragePath`
 * 
 * @throws iff file download goes wrong
 */
export default async function downloadFlix ({ workspaceFolders, globalStoragePath, shouldUpdateFlix }: DownloadFlixInput): Promise<DownloadFlixResult> {
  if (!shouldUpdateFlix) {
    // 1. If `flix.jar` exists in any workspace folder, use that
    for (let folder of workspaceFolders) {
      const filename = path.join(folder, FLIX_JAR)
      if (fs.existsSync(filename)) {
        return { filename }
      }
    }
    // 2. If `flix.jar` exists in `globalStoragePath`, use that
    const filename = path.join(globalStoragePath, FLIX_JAR)
    if (fs.existsSync(filename)) {
      return { filename }
    }
  }
  // 3. Otherwise download `FLIX_URL` into `globalStoragePath` (create folder if necessary)
  const filename = path.join(globalStoragePath, FLIX_JAR)
  if (!fs.existsSync(globalStoragePath)) {
    fs.mkdirSync(globalStoragePath)
  }
  const targetFile = fs.createWriteStream(filename)
  await downloadFile({ url: FLIX_URL, targetFile })
  return { filename }
}
