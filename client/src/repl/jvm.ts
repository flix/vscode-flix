import * as vscode from 'vscode'
import { LaunchOptions } from '../util/launchOptions'
import ensureFlixExists from '../compiler/download'

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
export async function getJvmCmd(context: vscode.ExtensionContext, launchOptions: LaunchOptions) {
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
export function getExtraFlixArgs() {
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
