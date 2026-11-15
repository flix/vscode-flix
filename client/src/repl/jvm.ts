import * as vscode from 'vscode'
import { LaunchOptions } from '../util/launchOptions'
import { findFlixJar } from '../compiler/download'
import { USER_MESSAGE } from '../ui/messages'

/**
 * It takes context and launchOptions as arguments and finds the path of `flix.jar`
 *
 * The jar is only located: making sure that it exists and is up to date is left to the start of
 * the session. Doing it here as well would try to replace a jar which the running compiler holds
 * open, which fails on Windows.
 *
 * @param context vscode.ExtensionContext
 *
 * @param launchOptions LauchOptions
 *
 * @returns string (path of `flix.jar`), or `undefined` if there is no `flix.jar`
 */
function getFlixFilename(context: vscode.ExtensionContext, launchOptions: LaunchOptions) {
  const globalStoragePath = context.globalStorageUri.fsPath
  const workspaceFolders = vscode.workspace.workspaceFolders?.map(ws => ws.uri.fsPath)
  return findFlixJar({
    globalStoragePath,
    workspaceFolders,
    shouldUpdateFlix: launchOptions.shouldUpdateFlix,
  })
}

/**
 * Generate a java command to run the Flix compiler.
 *
 * @throws if there is no `flix.jar` to run.
 */
export async function getJvmCmd(context: vscode.ExtensionContext, launchOptions: LaunchOptions) {
  const args: string[] = []
  args.push(...getExtraJvmArgs())
  const flixFilename = getFlixFilename(context, launchOptions)
  if (flixFilename === undefined) {
    throw new Error(USER_MESSAGE.FLIX_JAR_NOT_FOUND())
  }
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
