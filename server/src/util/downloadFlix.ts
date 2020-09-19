const { https } = require('follow-redirects')
const fs = require('fs')
const path = require('path')

const FLIX_URL = 'https://flix.dev/nightly/flix-2020-09-19.jar'

interface DownloadFileInput {
  url: string
  targetFile: string
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

export default async function (targetPath: string, skipIfExists = false) {
  if (!targetPath) {
    throw 'Must be called with targetPath'
  }
  const filename = path.join(targetPath, 'flix.jar')
  const flixExists = fs.existsSync(filename)
  if (flixExists && skipIfExists) {
    console.log('[downloadFlix] Skipping download')
    return
  }
  try {
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath)
    }
    console.log(`[debug] Downloading ${FLIX_URL} to ${filename}`)
    const targetFile = fs.createWriteStream(filename)
    return downloadFile({ url: FLIX_URL, targetFile })
  } catch (err) {
    if (!flixExists) {
      throw err
    } else {
      // there is a flix available, so we just continue
      console.error(err)
    }
  }
}
