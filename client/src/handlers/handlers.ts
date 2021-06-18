import * as vscode from 'vscode'
import { LanguageClient } from 'vscode-languageclient'

import * as jobs from '../engine/jobs'
import * as timers from '../services/timers'
import eventEmitter from '../services/eventEmitter'

export function makeHandleRunJob (
  client: LanguageClient,
  request: jobs.Request
) {
  return function handler () {
    client.sendNotification(request)
  }
}

let flixFileLocation
const FLIX_GLOB_PATTERN = '**/*.flix'

export function setFlixFileName(Filename:String) {
    flixFileLocation = Filename
}

function selectTerminal(): Thenable<vscode.Terminal | undefined> {
	interface TerminalQuickPickItem extends vscode.QuickPickItem {
		terminal: vscode.Terminal;
	}
	const terminals = <vscode.Terminal[]>(<any>vscode.window).terminals;
	let items: TerminalQuickPickItem[] = terminals.map(t => {
		return {
			label: `name: ${t.name}`,
			terminal: t
		};
	});
    items.push({label:`create a new terminal`, terminal: undefined})
	return vscode.window.showQuickPick(items).then(item => {
		return item ? item.terminal : undefined;
	});
}

function findFlixTerminal() {
    const activeTerminals = vscode.window.terminals
    for (let i = 0; i < activeTerminals.length; i++) {
        const element = activeTerminals[i];
        if(element.name == `flix`)
            return element
    }
    return undefined
}

function showActiveTerminals() {
    const activeTerminals = vscode.window.terminals
    for (let i = 0; i < activeTerminals.length; i++) {
        const element = activeTerminals[i];
        console.log(element)
    }
}

export async function compileInTerminal() {
    
    const files = await vscode.workspace.findFiles(FLIX_GLOB_PATTERN)
    let cmd = "java -jar "+flixFileLocation;
    for (let index = 0; index < files.length ; index++)
        cmd += " "+files[index].path;

    // method 1
    // let ter = findFlixTerminal()
    // if(!ter)
    // {
    //     ter = vscode.window.createTerminal({name: 'flix'});   
    // }
    // ter.show()
    // ter.sendText(cmd)

    // method 2
    if(vscode.window.terminals.length == 0) //no terminals active
    {
        let newterminal = vscode.window.createTerminal({name:`flix`, hideFromUser: false})
        newterminal.show()
        newterminal.sendText(cmd)
    }
    else { //select one terminal from drop down window
        selectTerminal().then(terminal => {
            if(terminal) {
                terminal.show()
                terminal.sendText(cmd)
            }
            else { //if user choose `create a new terminal`
                let newterminal = vscode.window.createTerminal({name:`flix`, hideFromUser: false})
                newterminal.show()
                newterminal.sendText(cmd)
            }
        })
    }
}

export function makeHandleRunJobWithProgress (
  client: LanguageClient, 
  outputChannel: vscode.OutputChannel, 
  request: jobs.Request, 
  title: string, 
  timeout: number = 180
) {
  return function handler () {
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title,
      cancellable: false
    }, function (_progress) {
      return new Promise(function resolver (resolve, reject) {
        client.sendNotification(request)

        const cancelCleanup = timers.ensureCleanupEventually(reject, timeout)
  
        eventEmitter.on(jobs.Request.internalFinishedJob, function readyHandler () {
          cancelCleanup()
          outputChannel.show()
          resolve()
        })
      })
    })
  }
}
