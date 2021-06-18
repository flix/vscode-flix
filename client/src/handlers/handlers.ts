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

/**
 * It sets the path of flix.jar to a local variable `flixFileLocation` in file `handlers.ts`.
 * 
 * @param Filename String (path of the flix.jar)
 * 
 * @return void
*/
export function setFlixFileName(Filename:String) {
    flixFileLocation = Filename
}

/**
 * returns a count of total active terminals with prefix name `flix`.
 * 
 * @return number
*/
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

/**
 * returns an active terminal with prefix name `flix`.
 * 
 * If not any active terminal with prefix name `flix`, it creates a new terminal with name `flix`.
 *
 * @return vscode.Terminal
*/
function ensureFlixTerminal() {
    const activeTerminals = vscode.window.terminals
    for (let i = 0; i < activeTerminals.length; i++) {
        const element = activeTerminals[i];
        if(element.name.substring(0, 4) == `flix`)
            return element
    }
    return vscode.window.createTerminal(`flix`);
}


/**
 * returns an new active terminal with prefix name `flix`.
 * 
 * If not any active terminal with prefix name `flix`, it creates a new terminal with name `flix` and returns it.
 *
 * If there are already `n` active terminals exist with prefix name `flix`, it creates a new terminal with name `flix n+1`
 *
 * @return vscode.Terminal
*/
function ensureNewFlixTerminal() {
    const count = countFlixTerminals()
    if(count == 0)
        return vscode.window.createTerminal(`flix`);
    else return vscode.window.createTerminal(`flix `+(count+1).toString())
}

/**
 * takes a string and a terminal and passes that string to the terminal.
 *
 * @param cmd string (a terminal command) to pass to the terminal.
 *
 * @param terminal vscode.Terminal 
 *
 * @return void
*/
function passCommandToTerminal(cmd:string, terminal: vscode.Terminal) {
    terminal.show();
    terminal.sendText(cmd);
}

/**
 * Opens an input box to ask the user for input.
 * uses the `vscode.window.showInputBox` function with custom `prompt` and `placeHolder` and value of `ignoreFocusOut` to be `true`.
 *
 *
 * @return A promise that resolves to a string the user provided or to `undefined` in case of dismissal.
*/
async function takeInputFromUser() {
    const input = await vscode.window.showInputBox({
        prompt: "Enter the space separated arguments",
        placeHolder: "Foo bar",
		ignoreFocusOut: true
    })
    return input
}

/**
 * combines the paths of all flix files present in the current directory of vscode window.
 * 
 * gets an array of vscode.Uri for all flix files using `vscode.workspace.findFiles` function
 *
 * @return string of format "\<path_to_first_file\>" "\<path_to_second_file\>" ..........
*/
async function getFiles() {
    const files = await vscode.workspace.findFiles(FLIX_GLOB_PATTERN)
    let cmd = ""
    for (let index = 0; index < files.length ; index++)
        cmd += " \""+files[index].path+"\"";
    return cmd
}

/**
 * sends a java command to compile and run flix program of vscode window to the terminal.
 *
 * @param terminal vscode.Terminal to receive the command. 
 *
 * @return void
*/
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

/**
 * Run main without any custom arguments
 * 
 * Sends command `java -jar <path_to_flix.jar> <paths_to_all_flix_files>` to an existing (if already exists else new) terminal.
 * 
 * @return void
*/
export async function RunInExistingTerminalWithoutArg() {
    let terminal = ensureFlixTerminal()
    let cmd = "java -jar "+flixFileLocation
    cmd += await getFiles()
    passCommandToTerminal(cmd, terminal)  
}

/**
 * Run main without any custom arguments in a new terminal
 * 
 * Sends command `java -jar <path_to_flix.jar> <paths_to_all_flix_files>` to a new terminal.
 * 
 * @return void
*/
export async function RunInNewTerminalWithoutArg() {
    let terminal = ensureNewFlixTerminal()
    let cmd = "java -jar "+flixFileLocation
    cmd += await getFiles()
    passCommandToTerminal(cmd, terminal)
}

/**
 * Run main with user provided arguments
 * 
 * Sends command `java -jar <path_to_flix.jar> <paths_to_all_flix_files> --args <arguments>` to an existing (if already exists else new) terminal.
 * 
 * @return void
*/
export async function RunInExistingTerminalWithArg() {
    let terminal = ensureFlixTerminal()
    await passArgs(terminal)
}

/**
 * Run main with user provided arguments in a new terminal
 * 
 * Sends command `java -jar <path_to_flix.jar> <paths_to_all_flix_files> --args <arguments>` to a new terminal.
 * 
 * @return void
*/
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
