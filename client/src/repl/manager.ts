import * as path from 'path'
import * as vscode from 'vscode'
import { LaunchOptions } from '../util/launchOptions'
import { isProjectMode } from '../util/workspace'
import { getJvmCmd, getExtraFlixArgs } from './jvm'

let flixTerminal: vscode.Terminal | null = null

/**
 * Returns the current REPL terminal instance, or null if none exists.
 */
export function getFlixTerminal(): vscode.Terminal | null {
  return flixTerminal
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
export async function ensureReplExists(context: vscode.ExtensionContext, launchOptions: LaunchOptions) {
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
  args.push(...getExtraFlixArgs())

  // In single-file mode, set cwd to the active file's directory so the REPL
  // can find the file. In project mode, VS Code defaults to the workspace root.
  const activeFilePath = vscode.window.activeTextEditor?.document.uri.fsPath
  const cwd = !isProjectMode() && activeFilePath ? path.dirname(activeFilePath) : undefined

  flixTerminal = vscode.window.createTerminal({
    name: 'Flix REPL',
    shellPath: cmd,
    shellArgs: args,
    cwd,

    // The terminal will not be kept alive when restarting VSCode.
    // This is necessary in the case where flix.jar has been removed while VSCode has been closed.
    isTransient: true,
  })
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
