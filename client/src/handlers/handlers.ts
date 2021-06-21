import * as vscode from 'vscode'
import { LanguageClient } from 'vscode-languageclient/node'

import * as jobs from '../engine/jobs'
import * as timers from '../services/timers'
import eventEmitter from '../services/eventEmitter'
import ensureFlixExists from './../util/ensureFlixExists'
import { LaunchOptions, defaultLaunchOptions, FLIX_GLOB_PATTERN, _ } from './../extension'

let countTerminals:number = 0

export function makeHandleRunJob (
  client: LanguageClient,
  request: jobs.Request
) {
  return function handler () {
    client.sendNotification(request)
  }
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
    for (const element of activeTerminals) {
        if(element.name.substring(0, 4) == `flix`)
            return element
    }
    const terminal = vscode.window.createTerminal(`flix-`+countTerminals.toString());
    countTerminals+=1 //creating a new terminal since no active flix terminals available.
    return terminal
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
    const terminal = vscode.window.createTerminal(`flix-`+countTerminals.toString())
    countTerminals+=1
    return terminal
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
        prompt: "Enter arguments separated by spaces",
        placeHolder: "arg0 arg1 arg2 ...",
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
    for (const file of files) {
        cmd += " \""+file.path+"\"";
    }
    return cmd
}

/**
 * sends a java command to compile and run flix program of vscode window to the terminal.
 *
 * @param terminal vscode.Terminal to receive the command. 
 *
 * @return void
*/
async function passArgs(terminal:vscode.Terminal, flixFilename: string) {

    let cmd = "java -jar \""+ flixFilename + "\""
    cmd += await getFiles()
    let input = await takeInputFromUser()
    if(input != undefined) {
        cmd += " --args \"";
        cmd += input;
        cmd += "\""
        passCommandToTerminal(cmd, terminal)  
    }
}

/**
 * Run main without any custom arguments
 * 
 * Sends command `java -jar <path_to_flix.jar> <paths_to_all_flix_files>` to an existing (if already exists else new) terminal.
 * 
 * @param context vscode.ExtensionContext
 * 
 * @param launchOptions LaunchOptions
 * 
 * @return function handler
*/
export function cmdRunMain(
    context: vscode.ExtensionContext, 
    launchOptions: LaunchOptions = defaultLaunchOptions
    ) {
        return async function handler () {
            const globalStoragePath = context.globalStoragePath
            const workspaceFolders = _.map(_.flow(_.get('uri'), _.get('fsPath')), vscode.workspace.workspaceFolders)
            const flixFilename = await ensureFlixExists({ globalStoragePath, workspaceFolders, shouldUpdateFlix: launchOptions.shouldUpdateFlix })
            
            let cmd = "java -jar \""+ flixFilename + "\""
            cmd += await getFiles()
            let terminal = ensureFlixTerminal()
            passCommandToTerminal(cmd, terminal)  
        }
}

/**
 * Run main with user provided arguments
 * 
 * Sends command `java -jar <path_to_flix.jar> <paths_to_all_flix_files> --args <arguments>` to an existing (if already exists else new) terminal.
 * 
 * @param context vscode.ExtensionContext
 * 
 * @param launchOptions LaunchOptions
 * 
 * @return function handler
*/
export function runMainWithArgs(
    context: vscode.ExtensionContext, 
    launchOptions: LaunchOptions = defaultLaunchOptions
    ) {
        return async function handler () {
            const globalStoragePath = context.globalStoragePath
            const workspaceFolders = _.map(_.flow(_.get('uri'), _.get('fsPath')), vscode.workspace.workspaceFolders)
            const flixFilename = await ensureFlixExists({ globalStoragePath, workspaceFolders, shouldUpdateFlix: launchOptions.shouldUpdateFlix })
            
            let terminal = ensureFlixTerminal()
            await passArgs(terminal, flixFilename)
        }
}

/**
 * Run main without any custom arguments in a new terminal
 * 
 * Sends command `java -jar <path_to_flix.jar> <paths_to_all_flix_files>` to a new terminal.
 * 
 * @param context vscode.ExtensionContext
 * 
 * @param launchOptions LaunchOptions
 * 
 * @return function handler
*/
export function runMainNewTerminal(
    context: vscode.ExtensionContext, 
    launchOptions: LaunchOptions = defaultLaunchOptions
    ) {
        return async function handler () {
            const globalStoragePath = context.globalStoragePath
            const workspaceFolders = _.map(_.flow(_.get('uri'), _.get('fsPath')), vscode.workspace.workspaceFolders)
            const flixFilename = await ensureFlixExists({ globalStoragePath, workspaceFolders, shouldUpdateFlix: launchOptions.shouldUpdateFlix })
            
            let terminal = ensureNewFlixTerminal()
            let cmd = "java -jar \""+ flixFilename + "\""
            cmd += await getFiles()
            passCommandToTerminal(cmd, terminal)
        }
}


/**
 * Run main with user provided arguments in a new terminal
 * 
 * Sends command `java -jar <path_to_flix.jar> <paths_to_all_flix_files> --args <arguments>` to a new terminal.
 * 
 * @param context vscode.ExtensionContext
 * 
 * @param launchOptions LaunchOptions
 * 
 * @return function handler
*/
export function runMainNewTerminalWithArgs(
    context: vscode.ExtensionContext, 
    launchOptions: LaunchOptions = defaultLaunchOptions
    ) {
        return async function handler () {
            const globalStoragePath = context.globalStoragePath
            const workspaceFolders = _.map(_.flow(_.get('uri'), _.get('fsPath')), vscode.workspace.workspaceFolders)
            const flixFilename = await ensureFlixExists({ globalStoragePath, workspaceFolders, shouldUpdateFlix: launchOptions.shouldUpdateFlix })
            
            let terminal = ensureNewFlixTerminal()
            await passArgs(terminal, flixFilename)
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
          resolve(undefined)
        })
      })
    })
  }
}
