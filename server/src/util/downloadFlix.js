const { https } = require('follow-redirects')
const fs = require('fs')
const path = require('path')

const FLIX_URL = 'https://github.com/flix/flix/releases/download/v0.13.0/flix.jar'

const downloadFile = ({ url, targetFile }) => new Promise((resolve, reject) => {
  try {
    https.get(url, response => {
      response.pipe(targetFile)
      response.on('close', resolve)
      response.on('error', reject)
    })
  } catch (err) {
    reject(err)
  }
})

export default async function ({ targetPath, skipIfExists = false } = {}) {
  if (!targetPath) {
    throw 'Must be called with targetPath'
  }
  const filename = path.join(targetPath, 'flix.jar')
  const flixExists = fs.existsSync(filename)
  if (flixExists && skipIfExists) {
    return
  }
  try {
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
