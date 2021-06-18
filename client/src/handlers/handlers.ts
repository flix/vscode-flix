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

function countFlixTerminals() {
    const activeTerminals = vscode.window.terminals
    let count = 0
    for (let i = 0; i < activeTerminals.length; i++) {
        const element = activeTerminals[i];
        if(element.name.substring(0, 4) == `flix`)
            count+=1
    }
    return count
}

function ensureFlixTerminal() {
    const activeTerminals = vscode.window.terminals
    for (let i = 0; i < activeTerminals.length; i++) {
        const element = activeTerminals[i];
        if(element.name.substring(0, 4) == `flix`)
            return element
    }
    return vscode.window.createTerminal(`flix`);
}

function ensureNewFlixTerminal() {
    const count = countFlixTerminals()
    if(count == 0)
        return vscode.window.createTerminal(`flix`);
    else return vscode.window.createTerminal(`flix `+(count+1).toString())
}

function passCommandToTerminal(cmd:string, terminal: vscode.Terminal) {
    terminal.show();
    terminal.sendText(cmd);
}

async function takeInputFromUser() {
    const input = await vscode.window.showInputBox({
        prompt: "Enter the space separated arguments",
        placeHolder: "Foo bar",
		ignoreFocusOut: true
    })
    return input
}

async function getFiles() {
    const files = await vscode.workspace.findFiles(FLIX_GLOB_PATTERN)
    let cmd = ""
    for (let index = 0; index < files.length ; index++)
        cmd += " \""+files[index].path+"\"";
    return cmd
}

async function passArgs(terminal:vscode.Terminal) {
    let cmd = "java -jar "+flixFileLocation
    cmd += await getFiles()
    let input = await takeInputFromUser()
    if(input != undefined) {
        cmd += " --args \"";
        cmd += input;
        cmd += "\""
        passCommandToTerminal(cmd, terminal)  
    }
    else {
        vscode.window.showErrorMessage("Process cancelled")
    }
}

export async function RunInExistingTerminalWithoutArg() {
    let terminal = ensureFlixTerminal()
    let cmd = "java -jar "+flixFileLocation
    cmd += await getFiles()
    passCommandToTerminal(cmd, terminal)  
}

export async function RunInNewTerminalWithoutArg() {
    let terminal = ensureNewFlixTerminal()
    let cmd = "java -jar "+flixFileLocation
    cmd += await getFiles()
    passCommandToTerminal(cmd, terminal)
}

export async function RunInExistingTerminalWithArg() {
    let terminal = ensureFlixTerminal()
    await passArgs(terminal)
}

export async function RunInNewTerminalWithArg() {
    let terminal = ensureNewFlixTerminal()
    await passArgs(terminal)
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
