import { ReadyParams } from '../handlers/lifecycle'
import downloadFlix from '../util/downloadFlix'

const path = require('path')
const ChildProcess = require('child_process')
const WebSocket = require('ws')

let flixInstance: any
let webSocket: any
let port = 8888

let webSocketOpen = false

export async function start ({ extensionPath }: ReadyParams) {
	if (flixInstance || webSocket) {
		stop()
	}

	try {
		await downloadFlix({ targetPath: extensionPath })
	} catch (err) {
		throw 'Could not download flix - refusing to start'
	}

	flixInstance = ChildProcess.spawn('java', ['-jar', path.join(extensionPath, 'flix.jar'), '--lsp', port])
	const webSocketUrl = `ws://localhost:${port}`

	flixInstance.stdout.on('data', (data: any) => {
		const str = data.toString().split(/(\r?\n)/g).join('')

		console.log(str)

		if(str.includes(webSocketUrl)) {
			webSocket = new WebSocket(webSocketUrl)

			webSocket.on('open', () => {
				webSocketOpen = true
			})

			webSocket.on('close', () => {
				webSocketOpen = false
			})

			webSocket.on('message', (data: any) => {
				console.log('websocket', data)
			})
		}
	})

	flixInstance.stderr.on('data', (data: any) => {
		// Text on missing/inaccessible: 'Error: Unable to access jarfile'
		const str = data.toString().split(/(\r?\n)/g).join('')
		console.log('[error]', str)
	})
}

export function stop () {
	if (flixInstance) {
		flixInstance.kill()
	}
	if (webSocket) {
		webSocket.close()
	}
}

export interface ValidateInput {
	uri: String
	src: String
}

// https://github.com/flix/flix/blob/master/main/src/ca/uwaterloo/flix/api/lsp/LanguageServer.scala#L166
export function validate ({ uri, src }: ValidateInput) {
	if (!webSocketOpen) {
		throw 'Websocket is not open'
	}
	const message = {
		request: 'api/addUri',
		uri,
		src
	}
	console.log(JSON.stringify(message))
	webSocket.send(JSON.stringify(message))
}
