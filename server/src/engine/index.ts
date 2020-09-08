import _ from 'lodash/fp'
import { ReadyParams } from '../handlers/lifecycle'
import downloadFlix from '../util/downloadFlix'

const path = require('path')
const ChildProcess = require('child_process')
const WebSocket = require('ws')

let flixInstance: any
let webSocket: any
let port = 8888

let webSocketOpen = false

interface FlixResponse {
	id: number
	status: string
}

interface JobMap {
	[key: string]: {
		request: string
	}
}

let jobs: JobMap = {
	// '1': {
	// 	request: 'lsp/check'
	// }
}

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

			webSocket.on('message', (data: string) => {
				const { id, status }: FlixResponse = JSON.parse(data)
				const idString = `${id}`
				if (status !== 'success') {
					console.error('Should handle status !== success')
					return
				}
				const job = jobs[idString]
				if (job.request === 'api/addUri') {
					const id = 2
					const idString = `${id}`
					const message = {
						request: 'lsp/check',
						id: 2
					}
					jobs[idString] = message
					console.log(JSON.stringify(message))
					webSocket.send(JSON.stringify(message))
				}
				if (job.request === 'lsp/check') {
					console.log('returning from check', job)
				}
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
export function validate ({ uri, src }: ValidateInput, retries = 0) {
	if (!webSocketOpen) {
		if (retries > 2) {
			return console.error('Could not validate - websocket not available')
		}
		setTimeout(() => {
			validate({ uri, src }, retries + 1)
		}, 1000)
		return
	}

	// this is a step on the way to performing code checks
	// we send a message with an id and add it to `jobs` to know what to do when it returns
	// will have to be fleshed out further
	const id = 1
	const idString = `${id}`
	const message = {
		request: 'api/addUri',
		uri,
		src,
		id: 1
	}
	jobs[idString] = message
	console.log(JSON.stringify(message))
	webSocket.send(JSON.stringify(message))
}
