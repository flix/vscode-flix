/*
 * Copyright 2020 Thomas Plougsgaard
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

const { https } = require('follow-redirects')
const fs = require('fs')
const path = require('path')

const FLIX_URL = 'https://flix.dev/nightly/flix-2020-10-05.jar'
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
