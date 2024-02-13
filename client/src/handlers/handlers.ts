import * as vscode from 'vscode'
import { LanguageClient } from 'vscode-languageclient/node'
import { quote } from 'shell-quote'

import * as jobs from '../engine/jobs'
import * as timers from '../services/timers'
import eventEmitter from '../services/eventEmitter'
import ensureFlixExists from './../util/ensureFlixExists'
import { LaunchOptions, defaultLaunchOptions, FLIX_GLOB_PATTERN, FPKG_GLOB_PATTERN } from './../extension'
import { USER_MESSAGE } from '../util/userMessages'

const _ = require('lodash/fp')

let FLIX_TERMINAL: vscode.Terminal | null = null

let countTerminals: number = 0

export function makeHandleRunJob(client: LanguageClient, request: jobs.Request) {
  return function handler() {
    client.sendNotification(request)
  }
}

/**
 * Creates a persistent shared repl on startup.
 */
export async function createSharedRepl(context: vscode.ExtensionContext, launchOptions: LaunchOptions) {
  if (FLIX_TERMINAL === null) {
    // Check if there is already a terminal with the name `REPL`
    // This is the case if the user has just restarted VSCode
    const activeTerminals = vscode.window.terminals
    for (const element of activeTerminals) {
      if (element.name.substring(0, 4) === `REPL`) {
        FLIX_TERMINAL = element
        launchReplInTerminal(FLIX_TERMINAL, context, launchOptions)
        break
      }
    }
  }

  ensureReplExists(context, launchOptions)
}

/**
 * Ensures that a repl still exists and creates a new one if not.
 *
 * @returns Whether or not a new repl was created.
 */
async function ensureReplExists(context: vscode.ExtensionContext, launchOptions: LaunchOptions) {
  const missing = FLIX_TERMINAL === null

  if (missing) {
    FLIX_TERMINAL = vscode.window.createTerminal('REPL')
    launchReplInTerminal(FLIX_TERMINAL, context, launchOptions)
  }

  vscode.window.onDidCloseTerminal(terminal => {
    if (terminal.name === FLIX_TERMINAL.name) {
      FLIX_TERMINAL = null
    }
  })

  return missing
}

/**
 * Launch the REPL in the given terminal.
 */
async function launchReplInTerminal(
  terminal: vscode.Terminal,
  context: vscode.ExtensionContext,
  launchOptions: LaunchOptions,
) {
  const cmd = await getJVMCmd(context, launchOptions)

  cmd.push('repl')
  if (vscode.workspace.getConfiguration('flix').get('explain.enabled')) {
    cmd.push('--explain')
  }
  cmd.push(...getExtraFlixArgs())

  terminal.sendText(quote(cmd))
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
    if (element.name.substring(0, 4) === `flix`) {
      return element
    }
  }
  const terminal = vscode.window.createTerminal(`flix-` + countTerminals.toString())
  countTerminals += 1 //creating a new terminal since no active flix terminals available.
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
  const terminal = vscode.window.createTerminal(`flix-` + countTerminals.toString())
  countTerminals += 1
  return terminal
}

/**
 * an array of string arguments entered by user in flix extension settings `Extra Flix Args`.
 * @returns string[]
 */

function getExtraFlixArgs() {
  const arg: string = vscode.workspace.getConfiguration('flix').get('extraFlixArgs')
  return arg.split(' ')
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
function passCommandToTerminal(cmd: string[], terminal: vscode.Terminal) {
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
  const { prompt, placeHolder } = USER_MESSAGE.ASK_PROGRAM_ARGS()
  const input = await vscode.window.showInputBox({
    prompt,
    placeHolder,
    ignoreFocusOut: true,
  })
  return input
}

async function handleUnsavedFiles() {
  const unsaved = []
  const textDocuments = vscode.workspace.textDocuments
  for (const textDocument of textDocuments) {
    if (textDocument.isDirty) {
      unsaved.push(textDocument)
    }
  }
  if (unsaved.length !== 0) {
    const { msg, option1, option2 } = USER_MESSAGE.ASK_SAVE_CHANGED_FILES()
    const action = await vscode.window.showWarningMessage(msg, option1, option2)
    if (action === option2) {
      await vscode.workspace.saveAll(false)
    }
  }
}

/**
 * combines the paths of all flix files present in the current directory of vscode window.
 *
 * gets an array of vscode.Uri for all flix files using `vscode.workspace.findFiles` function
 *
 * @return string of format "\<path_to_first_file\>" "\<path_to_second_file\>" ..........
 */
async function getFiles() {
  await handleUnsavedFiles()
  const flixFiles = await vscode.workspace.findFiles(FLIX_GLOB_PATTERN)
  const fpkgFiles = await vscode.workspace.findFiles(FPKG_GLOB_PATTERN)
  const files = []
  files.push(...flixFiles)
  files.push(...fpkgFiles)
  return files.map(x => x.fsPath)
}

/**
 * sends a java command to compile and run flix program of vscode window to the terminal.
 *
 * @param terminal vscode.Terminal
 * @param args string
 * @param context vscode.ExtensionContext
 * @param launchOptions LaunchOptions
 */
async function passArgs(
  terminal: vscode.Terminal,
  args: string,
  context: vscode.ExtensionContext,
  launchOptions: LaunchOptions = defaultLaunchOptions,
  entryPoint?: string,
) {
  const cmd = await getJVMCmd(context, launchOptions, entryPoint)
  cmd.push(...(await getFiles()))
  if (args.trim().length !== 0) {
    cmd.push('--args')
    cmd.push(args)
  }
  cmd.push(...getExtraFlixArgs())
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
async function getFlixFilename(context: vscode.ExtensionContext, launchOptions: LaunchOptions) {
  const globalStoragePath = context.globalStorageUri.fsPath
  const workspaceFolders = _.map(_.flow(_.get('uri'), _.get('fsPath')), vscode.workspace.workspaceFolders)
  return await ensureFlixExists({
    globalStoragePath,
    workspaceFolders,
    shouldUpdateFlix: launchOptions.shouldUpdateFlix,
  })
}

/**
 * generate a java command to compile the flix program.
 * @param context vscode.ExtensionContext
 * @param launchOptions LaunchOptions
 * @returns string[]
 */
async function getJVMCmd(
  context: vscode.ExtensionContext,
  launchOptions: LaunchOptions = defaultLaunchOptions,
  entryPoint?: string,
) {
  const flixFilename = await getFlixFilename(context, launchOptions)
  const jvm: string = vscode.workspace.getConfiguration('flix').get('extraJvmArgs')
  const cmd = ['java']
  if (jvm.length !== 0) {
    cmd.push(...jvm.split(' '))
  }
  cmd.push(...['-jar', flixFilename])
  if (entryPoint && entryPoint.length > 0) {
    cmd.push(...['--entrypoint', entryPoint])
  }
  return cmd
}

/**
 * Run the given command in an existing (if already exists else new) terminal.
 *
 * @param context vscode.ExtensionContext
 *
 * @param launchOptions LaunchOptions
 *
 * @param cmd string | ((...args: A) => string) | ((...args: A) => Promise<string>)
 *
 * Either a string or an (optionally async) function returning a string.
 *
 * @returns function handler
 */
function runCmd<A extends unknown[]>(
  context: vscode.ExtensionContext,
  launchOptions: LaunchOptions = defaultLaunchOptions,
  cmd: string | ((...args: A) => string) | ((...args: A) => Promise<string>),
) {
  return async (...args: A) => {
    async function prepareRepl() {
      const newRepl = await ensureReplExists(context, launchOptions)
      FLIX_TERMINAL.show()

      // Wait for the REPL to start up and become responsive
      if (newRepl) {
        await new Promise(r => setTimeout(r, 2000))
      }
    }

    await Promise.allSettled([handleUnsavedFiles(), prepareRepl()])

    if (typeof cmd === 'string') {
      FLIX_TERMINAL.sendText(cmd)
    } else {
      FLIX_TERMINAL.sendText(await cmd(...args))
    }
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
export function runMain(context: vscode.ExtensionContext, launchOptions: LaunchOptions = defaultLaunchOptions) {
  return runCmd(context, launchOptions, (entryPoint: string) => `:eval ${entryPoint}()`)
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
export function runMainWithArgs(context: vscode.ExtensionContext, launchOptions: LaunchOptions = defaultLaunchOptions) {
  return runCmd(context, launchOptions, async (entryPoint: string) => {
    const input = await takeInputFromUser()
    if (input === undefined) {
      return ''
    }

    const args = input.split(' ').map(s => `"${s}"`)
    return `:eval ${entryPoint}(${args.join(', ')})`
  })
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
  launchOptions: LaunchOptions = defaultLaunchOptions,
) {
  return async function handler(entryPoint) {
    const terminal = newFlixTerminal()
    const cmd = await getJVMCmd(context, launchOptions, entryPoint)
    cmd.push(...(await getFiles()))
    cmd.push(...getExtraFlixArgs())
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
  launchOptions: LaunchOptions = defaultLaunchOptions,
) {
  return async function handler(entryPoint) {
    const input = await takeInputFromUser()
    if (input !== undefined) {
      const terminal = newFlixTerminal()
      await passArgs(terminal, input, context, launchOptions, entryPoint)
    }
  }
}

export function makeHandleRunJobWithProgress(
  client: LanguageClient,
  outputChannel: vscode.OutputChannel,
  request: jobs.Request,
  title: string,
  timeout: number = 180,
) {
  return function handler() {
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: false,
      },
      function (_progress) {
        return new Promise(function resolver(resolve, reject) {
          client.sendNotification(request)

          const cancelCleanup = timers.ensureCleanupEventually(reject, timeout)

          eventEmitter.on(jobs.Request.internalFinishedJob, function readyHandler() {
            cancelCleanup()
            outputChannel.show()
            resolve(undefined)
          })
        })
      },
    )
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
    if (element.name === name) {
      return element
    }
  }
  return vscode.window.createTerminal({ name: name })
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
export function cmdInit(context: vscode.ExtensionContext, launchOptions: LaunchOptions = defaultLaunchOptions) {
  return runCmd(context, launchOptions, ':init')
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

export function cmdCheck(context: vscode.ExtensionContext, launchOptions: LaunchOptions = defaultLaunchOptions) {
  return runCmd(context, launchOptions, ':check')
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
export function cmdBuild(context: vscode.ExtensionContext, launchOptions: LaunchOptions = defaultLaunchOptions) {
  return runCmd(context, launchOptions, ':build')
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
export function cmdBuildJar(context: vscode.ExtensionContext, launchOptions: LaunchOptions = defaultLaunchOptions) {
  return runCmd(context, launchOptions, ':jar')
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
export function cmdBuildPkg(context: vscode.ExtensionContext, launchOptions: LaunchOptions = defaultLaunchOptions) {
  return runCmd(context, launchOptions, ':pkg')
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
export function cmdRunProject(context: vscode.ExtensionContext, launchOptions: LaunchOptions = defaultLaunchOptions) {
  return runCmd(context, launchOptions, ':eval main()')
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
export function cmdTests(context: vscode.ExtensionContext, launchOptions: LaunchOptions = defaultLaunchOptions) {
  return runCmd(context, launchOptions, ':test')
}

/**
 * builds the documentation for the current project using the command `java -jar flix.jar doc`
 *
 * @param context vscode.ExtensionContext
 *
 * @param launchOptions LaunchOptions
 *
 * @returns function handler
 */
export function cmdDoc(context: vscode.ExtensionContext, launchOptions: LaunchOptions = defaultLaunchOptions) {
  return runCmd(context, launchOptions, ':doc')
}

/**
 * Prompt the user for a phase and show the AST for that phase.
 *
 * @returns function handler
 */
export function showAst(client: LanguageClient) {
  return async function handler() {
    const phase = await vscode.window.showInputBox({
      prompt: 'Enter the phase to show the AST for',
      placeHolder: 'Phase',
    })
    console.log(phase)
    if (phase === undefined) {
      return
    }

    client.sendNotification(jobs.Request.lspShowAst, {
      uri: vscode.window.activeTextEditor.document.uri.fsPath,
      phase: phase,
    })
  }
}
