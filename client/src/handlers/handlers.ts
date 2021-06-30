import * as vscode from 'vscode'
import { LanguageClient } from 'vscode-languageclient/node'
import { quote } from 'shell-quote'

import * as jobs from '../engine/jobs'
import * as timers from '../services/timers'
import eventEmitter from '../services/eventEmitter'
import ensureFlixExists from './../util/ensureFlixExists'
import { LaunchOptions, defaultLaunchOptions, FLIX_GLOB_PATTERN, FPKG_GLOB_PATTERN } from './../extension'

const _ = require('lodash/fp')

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
function getFlixTerminal() {
    const activeTerminals = vscode.window.terminals
    for (const element of activeTerminals) {
        if(element.name.substring(0, 4) == `flix`)
            return element
    }
    const terminal = vscode.window.createTerminal(`flix-`+countTerminals.toString())
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
function newFlixTerminal() {
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
function passCommandToTerminal(cmd:string[], terminal: vscode.Terminal) {
    terminal.show()
    terminal.sendText(quote(cmd))
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
    const flixFiles = await vscode.workspace.findFiles(FLIX_GLOB_PATTERN)
    const fpkgFiles = await vscode.workspace.findFiles(FPKG_GLOB_PATTERN)
    let files = []
    files.push(...flixFiles)
    files.push(...fpkgFiles)
    return files.map(x => x.fsPath)
}

/**
 * sends a java command to compile and run flix program of vscode window to the terminal.
 *
 * @param terminal vscode.Terminal to receive the command. 
 *
 * @return void
*/
async function passArgs(terminal:vscode.Terminal, flixFilename: string, args: string) {
    let cmd = ['java', '-jar', flixFilename]
    cmd.push(...await getFiles())

    if(args.trim().length != 0) {
        cmd.push("--args")
        cmd.push(args)
    }
    passCommandToTerminal(cmd, terminal)  
}

/**
 * It takes context and launchOptions as arguments and finds the path of `flix.jar`
 * 
 * @param context vscode.ExtensionContext
 * 
 * @param launchOptions LauchOptions
 * 
 * @returns string (path of `flix.jar`)
 */
async function getFlixFilename(context:vscode.ExtensionContext, launchOptions: LaunchOptions) {
    const globalStoragePath = context.globalStoragePath
    const workspaceFolders = _.map(_.flow(_.get('uri'), _.get('fsPath')), vscode.workspace.workspaceFolders)
    return await ensureFlixExists({ globalStoragePath, workspaceFolders, shouldUpdateFlix: launchOptions.shouldUpdateFlix })
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

export function runMain(
    context: vscode.ExtensionContext, 
    launchOptions: LaunchOptions = defaultLaunchOptions
    ) {
        return async function handler () {
            const flixFilename = await getFlixFilename(context, launchOptions)
            let cmd = ['java', '-jar', flixFilename]
            cmd.push(...await getFiles())
            let terminal = getFlixTerminal()
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
            const flixFilename = await getFlixFilename(context, launchOptions)
            let input = await takeInputFromUser()
            if(input != undefined)
            {
                let terminal = getFlixTerminal()
                await passArgs(terminal, flixFilename, input)
            }
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
            const flixFilename = await getFlixFilename(context, launchOptions)
            let terminal = newFlixTerminal()
            let cmd = ['java', '-jar', flixFilename]
            cmd.push(...await getFiles())
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
            const flixFilename = await getFlixFilename(context, launchOptions)
            let input = await takeInputFromUser()
            if(input != undefined)
            {
                let terminal = newFlixTerminal()
                await passArgs(terminal, flixFilename, input)
            }
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


/**
 * Returns a terminal with the given name (new if already not exists)
 * 
 * @param name name of the terminal
 * 
 * @returns vscode.Terminal
 */

function getTerminal(name: string) {
    const activeTerminals = vscode.window.terminals
    for (const element of activeTerminals) {
        if(element.name == name)
            return element
    }
    return vscode.window.createTerminal({name: name})
}



/**
 * creates a new project in the current directory using command `java -jar flix.jar init`
 * 
 * @param context vscode.ExtensionContext
 * 
 * @param launchOptions LaunchOptions
 * 
 * @returns function handler
 */
 export function cmdInit(
    context: vscode.ExtensionContext, 
    launchOptions: LaunchOptions = defaultLaunchOptions
    ) {
        return async function handler () {
            const flixFilename = await getFlixFilename(context, launchOptions)
            const cmd = ['java', '-jar', flixFilename, 'init']
            let terminal = getTerminal('init')
            passCommandToTerminal(cmd, terminal)
        }
}

/**
 * checks the current project for errors using command `java -jar flix.jar check`
 * 
 * @param context vscode.ExtensionContext
 * 
 * @param launchOptions LaunchOptions
 * 
 * @returns function handler
 */

export function cmdCheck(
    context: vscode.ExtensionContext, 
    launchOptions: LaunchOptions = defaultLaunchOptions
    ) {
        return async function handler () {
            const flixFilename = await getFlixFilename(context, launchOptions)
            const cmd = ['java', '-jar', flixFilename, 'check']
            let terminal = getTerminal('check')
            passCommandToTerminal(cmd, terminal)
        }
}

/**
 * builds (i.e. compiles) the current project using command `java -jar flix.jar build`
 * 
 * @param context vscode.ExtensionContext
 * 
 * @param launchOptions LaunchOptions
 * 
 * @returns function handler
 */
export function cmdBuild(
    context: vscode.ExtensionContext, 
    launchOptions: LaunchOptions = defaultLaunchOptions
    ) {
        return async function handler () {
            const flixFilename = await getFlixFilename(context, launchOptions)
            const cmd = ['java', '-jar', flixFilename, 'build']
            let terminal = getTerminal('build')
            passCommandToTerminal(cmd, terminal)
        }
}

/**
 * builds a jar-file from the current project using command `java -jar flix.jar build-jar`
 * 
 * @param context vscode.ExtensionContext
 * 
 * @param launchOptions LaunchOptions
 * 
 * @returns function handler
 */
export function cmdBuildJar(
    context: vscode.ExtensionContext, 
    launchOptions: LaunchOptions = defaultLaunchOptions
    ) {
        return async function handler () {
            const flixFilename = await getFlixFilename(context, launchOptions)
            const cmd = ['java', '-jar', flixFilename, 'build-jar']
            let terminal = getTerminal('build-jar')
            passCommandToTerminal(cmd, terminal)
        }
}

/**
 * builds a fpkg-file from the current project using command `java -jar flix.jar build-pkg`
 * 
 * @param context vscode.ExtensionContext
 * 
 * @param launchOptions LaunchOptions
 * 
 * @returns function handler
 */
export function cmdBuildPkg(
    context: vscode.ExtensionContext, 
    launchOptions: LaunchOptions = defaultLaunchOptions
    ) {
        return async function handler () {
            const flixFilename = await getFlixFilename(context, launchOptions)
            const cmd = ['java', '-jar', flixFilename, 'build-pkg']
            let terminal = getTerminal('build-pkg')
            passCommandToTerminal(cmd, terminal)
        }
}

/**
 * runs main for the current project using command `java -jar flix.jar run`
 * 
 * @param context vscode.ExtensionContext
 * 
 * @param launchOptions LaunchOptions
 * 
 * @returns function handler
 */
export function cmdRunProject(
    context: vscode.ExtensionContext, 
    launchOptions: LaunchOptions = defaultLaunchOptions
    ) {
        return async function handler () {
            const flixFilename = await getFlixFilename(context, launchOptions)
            const cmd = ['java', '-jar', flixFilename, 'run']
            let terminal = getTerminal('run')
            passCommandToTerminal(cmd, terminal)
        }
}

/**
 * runs the benchmarks for the current project using command `java -jar flix.jar benchmark`
 * 
 * @param context vscode.ExtensionContext
 * 
 * @param launchOptions LaunchOptions
 * 
 * @returns function handler
 */
export function cmdBenchmark(
    context: vscode.ExtensionContext, 
    launchOptions: LaunchOptions = defaultLaunchOptions
    ) {
        return async function handler () {
            const flixFilename = await getFlixFilename(context, launchOptions)
            const cmd = ['java', '-jar', flixFilename, 'benchmark']
            let terminal = getTerminal('benchmark')
            passCommandToTerminal(cmd, terminal)
        }
}

/**
 * runs all the tests for the current project using command `java -jar flix.jar test`
 * 
 * @param context vscode.ExtensionContext
 * 
 * @param launchOptions LaunchOptions
 * 
 * @returns function handler
 */
export function cmdTests(
    context: vscode.ExtensionContext, 
    launchOptions: LaunchOptions = defaultLaunchOptions
    ) {
        return async function handler () {
            const flixFilename = await getFlixFilename(context, launchOptions)
            const cmd = ['java', '-jar', flixFilename, 'test']
            let terminal = getTerminal('test')
            passCommandToTerminal(cmd, terminal)
        }
}

/**
 * runs the custom tests for the current project using command `java -jar flix.jar test <test01> <test02> ...`
 * 
 * @param context vscode.ExtensionContext
 * 
 * @param launchOptions LaunchOptions
 * 
 * @returns function handler
 */
export function cmdTestWithFilter(
    context: vscode.ExtensionContext, 
    launchOptions: LaunchOptions = defaultLaunchOptions
    ) {
        return async function handler () {
            const flixFilename = await getFlixFilename(context, launchOptions)
            const cmd = ['java', '-jar', flixFilename, 'test']
            const input = await vscode.window.showInputBox({
                prompt: "Enter names of test functions separated by spaces",
                placeHolder: "test01 test02 ...",
                ignoreFocusOut: true
            })
            if(input != undefined)
            {
                cmd.push(input)
                let terminal = getTerminal('testWithFilter')
                passCommandToTerminal(cmd, terminal)
            }
        }
}