const http = require('http')
const fs = require('fs')
const path = require('path')

const FLIX_URL = 'http://github.com/flix/flix/releases/download/v0.13.0/flix.jar'

const downloadFile = url => new Promise((resolve, reject) => {
	try {
		http.get(url, resolve)
	} catch (err) {
		reject(err)
	}
})

export default async function ({ targetPath }) {
	if (!targetPath) {
		throw 'Must be called with targetPath'
	}
	const targetFile = fs.createWriteStream(path.join([targetPath, 'flix.jar']))
	const response = await downloadFile(FLIX_URL)
	response.pipe(targetFile)
}
