// Used to spawn the java process that runs the flix compiler
const path = require('path')
const childProcess = require('child_process')
const WebSocket = require('ws')

let flixInstance

let webSocket

export function start () {
	flixInstance = childProcess.spawn('java', ['-jar', path.join(__dirname, 'flix-2020-07-24.jar'), '--lsp', 8888])
	flixInstance.stdout.on('data', (data: any) => {
		const str = data.toString().split(/(\r?\n)/g).join('')
		console.log(str);
		if(str.includes("ws://localhost:8888")) {
			webSocket = new WebSocket("ws://localhost:8888")
		}
	})
	flixInstance.stderr.on('data', (data: any) => {
		// Text on missing/inaccessible: 'Error: Unable to access jarfile'
		const str = data.toString().split(/(\r?\n)/g).join('')
		console.log('[error]', str)
	})
}
