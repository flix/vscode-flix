import * as vscode from 'vscode'
import { LanguageClient } from 'vscode-languageclient/node'
import { EventEmitter } from 'events'

import * as jobs from '../engine/jobs'
import ensureFlixExists from './../util/ensureFlixExists'
import { LaunchOptions, defaultLaunchOptions, FLIX_GLOB_PATTERN } from './../extension'
import { USER_MESSAGE } from '../util/userMessages'

let flixTerminal: vscode.Terminal | null = null

/**
 * Request that the server should disconnect. Returns promise that will resolve when the server has been reconnected.
 * Used for testing purposes.
 */
export function simulateDisconnect(client: LanguageClient) {
  return () => client.sendNotification(jobs.Request.apiDisconnect)
}

export function makeHandleRunJob(client: LanguageClient, request: jobs.Request) {
  return function handler() {
    client.sendNotification(request)
  }
}

/**
 * Creates and initializes persistent shared REPL on startup.
 */
export async function initSharedRepl(context: vscode.ExtensionContext, launchOptions: LaunchOptions) {
  await launchRepl(context, launchOptions)
  vscode.window.onDidCloseTerminal(async terminal => {
    if ((await terminal.processId) === (await flixTerminal?.processId)) {
      flixTerminal = null
    }
  })
}

/**
 * Ensures that a REPL still exists and launches a new one if not.
 *
 * @returns Whether or not a new REPL was launched.
 */
async function ensureReplExists(context: vscode.ExtensionContext, launchOptions: LaunchOptions) {
  const missing = flixTerminal === null

  if (missing) {
    await launchRepl(context, launchOptions)
  }

  return missing
}

/**
 * Launches a new REPL as a shell process.
 */
async function launchRepl(context: vscode.ExtensionContext, launchOptions: LaunchOptions) {
  const { cmd, args } = await getJvmCmd(context, launchOptions)
  args.push('repl')
  if (vscode.workspace.getConfiguration('flix').get('explain.enabled')) {
    args.push('--explain')
  }
  args.push(...getExtraFlixArgs())
  flixTerminal = vscode.window.createTerminal({
    name: 'Flix REPL',
    shellPath: cmd,
    shellArgs: args,

    // The terminal will not be kept alive when restarting VSCode.
    // This is necessary in the case where flix.jar has been removed while VSCode has been closed.
    isTransient: true,
  })
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
  const workspaceFolders = vscode.workspace.workspaceFolders?.map(ws => ws.uri.fsPath)
  return await ensureFlixExists({
    globalStoragePath,
    workspaceFolders,
    shouldUpdateFlix: launchOptions.shouldUpdateFlix,
  })
}

/**
 * Generate a java command to run the Flix compiler.
 */
async function getJvmCmd(context: vscode.ExtensionContext, launchOptions: LaunchOptions) {
  const args: string[] = []
  args.push(...getExtraJvmArgs())
  const flixFilename = await getFlixFilename(context, launchOptions)
  args.push(...['--enable-native-access=ALL-UNNAMED', '-jar', flixFilename])
  return { cmd: 'java', args }
}

/**
 * An array of string arguments entered by user in flix extension settings `Extra JVM Args`.
 */
function getExtraJvmArgs() {
  return parseArgs(vscode.workspace.getConfiguration('flix').get('extraJvmArgs'))
}
/**
 * An array of string arguments entered by user in flix extension settings `Extra Flix Args`.
 */
function getExtraFlixArgs() {
  return parseArgs(vscode.workspace.getConfiguration('flix').get('extraFlixArgs'))
}

/**
 * Parses the argument string into a list of arguments.
 */
function parseArgs(args: string): Array<string> {
  const trimmed = args.trim()
  if (trimmed === '') {
    return []
  } else {
    return args.split(' ')
  }
}

/**
 * Handle the user changing the active editor, to view a different file.
 *
 * If the new file is not part of the project, it shows a message to the user.
 */
export function handleChangeEditor(editor: vscode.TextEditor | undefined) {
  if (editor === undefined) {
    return
  }

  const isFlixFile = editor.document.uri.path.endsWith('.flix')
  if (!isFlixFile) {
    return
  }

  // Skip validation for virtual URIs (like stdlib files from JAR)
  if (editor.document.uri.scheme !== 'file') {
    return
  }

  const included = vscode.languages.match({ pattern: FLIX_GLOB_PATTERN }, editor.document)
  if (!included) {
    vscode.window.showWarningMessage(USER_MESSAGE.FILE_NOT_PART_OF_PROJECT())
  }
}

/**
 * Create a handler to run the given command in an existing (if already exists else new) REPL.
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
function runReplCmd<A extends unknown[]>(
  context: vscode.ExtensionContext,
  launchOptions: LaunchOptions = defaultLaunchOptions,
  cmd: string | ((...args: A) => string) | ((...args: A) => Promise<string>),
) {
  return async (...args: A) => {
    async function prepareRepl() {
      const newRepl = await ensureReplExists(context, launchOptions)
      flixTerminal.show()

      // Wait for the REPL to start up and become responsive
      if (newRepl) {
        await new Promise(r => setTimeout(r, 2000))
      }
    }

    await Promise.allSettled([handleUnsavedFiles(), prepareRepl()])

    if (typeof cmd === 'string') {
      flixTerminal.sendText(cmd)
    } else {
      flixTerminal.sendText(await cmd(...args))
    }
  }
}

/**
 * Run main without any custom arguments.
 *
 * Sends command `:eval <entryPoint>()` to an existing (if already exists else new) REPL.
 *
 * @param context vscode.ExtensionContext
 *
 * @param launchOptions LaunchOptions
 *
 * @return function handler
 */
export function runMain(context: vscode.ExtensionContext, launchOptions: LaunchOptions = defaultLaunchOptions) {
  return runReplCmd(context, launchOptions, (entryPoint: string) => `:eval ${entryPoint}()`)
}

/**
 * creates a new project in the current directory using command `:init`.
 *
 * @param context vscode.ExtensionContext
 *
 * @param launchOptions LaunchOptions
 *
 * @returns function handler
 */
export function cmdInit(context: vscode.ExtensionContext, launchOptions: LaunchOptions = defaultLaunchOptions) {
  return runReplCmd(context, launchOptions, ':init')
}

/**
 * checks the current project for errors using command `:check`.
 *
 * @param context vscode.ExtensionContext
 *
 * @param launchOptions LaunchOptions
 *
 * @returns function handler
 */

export function cmdCheck(context: vscode.ExtensionContext, launchOptions: LaunchOptions = defaultLaunchOptions) {
  return runReplCmd(context, launchOptions, ':check')
}

/**
 * builds (i.e. compiles) the current project using command `:build`.
 *
 * @param context vscode.ExtensionContext
 *
 * @param launchOptions LaunchOptions
 *
 * @returns function handler
 */
export function cmdBuild(context: vscode.ExtensionContext, launchOptions: LaunchOptions = defaultLaunchOptions) {
  return runReplCmd(context, launchOptions, ':build')
}

/**
 * builds a jar-file from the current project using command `:jar`.
 *
 * @param context vscode.ExtensionContext
 *
 * @param launchOptions LaunchOptions
 *
 * @returns function handler
 */
export function cmdBuildJar(context: vscode.ExtensionContext, launchOptions: LaunchOptions = defaultLaunchOptions) {
  return runReplCmd(context, launchOptions, ':jar')
}

/**
 * Builds a fatjar-file from the current project using command `:fatjar`.
 *
 * @param context vscode.ExtensionContext
 *
 * @param launchOptions LaunchOptions
 *
 * @returns function handler
 */
export function cmdBuildFatjar(context: vscode.ExtensionContext, launchOptions: LaunchOptions = defaultLaunchOptions) {
  return runReplCmd(context, launchOptions, ':fatjar')
}

/**
 * builds a fpkg-file from the current project using command `:pkg
 *
 * @param context vscode.ExtensionContext
 *
 * @param launchOptions LaunchOptions
 *
 * @returns function handler
 */
export function cmdBuildPkg(context: vscode.ExtensionContext, launchOptions: LaunchOptions = defaultLaunchOptions) {
  return runReplCmd(context, launchOptions, ':pkg')
}

/**
 * runs main for the current project using command `:run main()`.
 *
 * @param context vscode.ExtensionContext
 *
 * @param launchOptions LaunchOptions
 *
 * @returns function handler
 */
export function cmdRunProject(context: vscode.ExtensionContext, launchOptions: LaunchOptions = defaultLaunchOptions) {
  return runReplCmd(context, launchOptions, ':eval main()')
}

/**
 * runs all the tests for the current project using command `:test`.
 *
 * @param context vscode.ExtensionContext
 *
 * @param launchOptions LaunchOptions
 *
 * @returns function handler
 */
export function cmdTests(context: vscode.ExtensionContext, launchOptions: LaunchOptions = defaultLaunchOptions) {
  return runReplCmd(context, launchOptions, ':test')
}

/**
 * builds the documentation for the current project using the command `:doc`.
 *
 * @param context vscode.ExtensionContext
 *
 * @param launchOptions LaunchOptions
 *
 * @returns function handler
 */
export function cmdDoc(context: vscode.ExtensionContext, launchOptions: LaunchOptions = defaultLaunchOptions) {
  return runReplCmd(context, launchOptions, ':doc')
}

/**
 * Shows dependencies which have newer versions available using the command `:outdated`.
 *
 * @param context vscode.ExtensionContext
 *
 * @param launchOptions LaunchOptions
 *
 * @returns function handler
 */
export function cmdOutdated(context: vscode.ExtensionContext, launchOptions: LaunchOptions = defaultLaunchOptions) {
  return runReplCmd(context, launchOptions, ':outdated')
}

/**
 * Prompt the user for a phase and show the AST for that phase.
 *
 * @returns function handler
 */
export function showAst(client: LanguageClient) {
  return async function handler() {
    client.sendNotification(jobs.Request.lspShowAst, {
      uri: vscode.window.activeTextEditor.document.uri.fsPath,
    })
  }
}

/**
 * Start the REPL, or bring it to the front if it already exists.
 *
 * @returns function handler
 */
export function startRepl(context: vscode.ExtensionContext, launchOptions: LaunchOptions) {
  return async () => {
    await ensureReplExists(context, launchOptions)
    flixTerminal?.show()
  }
}

export function allJobsFinished(client: LanguageClient, eventEmitter: EventEmitter) {
  return () =>
    new Promise(resolve => {
      client.sendNotification(jobs.Request.internalFinishedAllJobs)
      eventEmitter.once(jobs.Request.internalFinishedAllJobs, resolve)
    })
}
