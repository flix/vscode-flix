import * as vscode from 'vscode'
import { getSessionFlixJar } from '../lsp/session'
import { USER_MESSAGE } from '../ui/messages'

/**
 * Generate a java command to run the Flix compiler.
 *
 * It runs the jar of the session, so that whatever is launched with it runs the same version as
 * the compiler. Making sure that a jar exists and is up to date is left to the start of the
 * session.
 *
 * @throws if the session has no jar to run.
 */
export async function getJvmCmd() {
  const args: string[] = []
  args.push(...getExtraJvmArgs())
  const flixFilename = getSessionFlixJar()
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
