import * as vscode from 'vscode'
import { LaunchOptions, defaultLaunchOptions } from '../util/launchOptions'
import { USER_MESSAGE } from '../ui/messages'
import { ensureReplExists, getFlixTerminal } from '../repl/manager'

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
      getFlixTerminal().show()

      // Wait for the REPL to start up and become responsive
      if (newRepl) {
        await new Promise(r => setTimeout(r, 2000))
      }
    }

    await Promise.allSettled([handleUnsavedFiles(), prepareRepl()])

    if (typeof cmd === 'string') {
      getFlixTerminal().sendText(cmd)
    } else {
      getFlixTerminal().sendText(await cmd(...args))
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
