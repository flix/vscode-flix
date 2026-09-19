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
