import * as vscode from 'vscode'
import { LanguageClient } from 'vscode-languageclient/node'
import * as jobs from '../protocol/requests'
import eventEmitter from '../util/eventBus'
import { FlixLspTerminal } from '../ui/compilerTerminal'
import { StatusCode } from '../protocol/statusCodes'
import { USER_MESSAGE } from '../ui/messages'

let hasReceivedReadyMessage = false

export function getUserConfiguration() {
  return vscode.workspace.getConfiguration('flix')
}

function handleShowAst({ status, result }) {
  if (status === StatusCode.Success) {
    const content: string = 'ASTs saved to: ' + result.path
    vscode.window.showInformationMessage(content)
  } else {
    const msg = USER_MESSAGE.CANT_SHOW_AST()
    vscode.window.showInformationMessage(msg)
  }
}

interface Action {
  title: string
  command: {
    type: 'openFile'
    path: string
  }
}

async function handleError({ message, actions }: { message: string; actions: Action[] }) {
  const selection = await vscode.window.showErrorMessage(message, ...actions.map(a => a.title))
  const action = actions.find(a => a.title === selection)
  if (action?.command?.type === 'openFile') {
    const uri = vscode.Uri.file(action.command.path)
    vscode.window.showTextDocument(uri)
  }
}

/**
 * Register all server-to-client notification listeners on the language client.
 * Called at the start of each session.
 *
 * @param onReady Callback invoked when the server signals it is ready.
 */
export function setupNotificationListeners(
  client: LanguageClient,
  flixLspTerminal: FlixLspTerminal,
  onReady: () => void,
) {
  hasReceivedReadyMessage = false

  client.onNotification(jobs.Request.internalReady, () => {
    // waits for server to answer back after having started successfully
    eventEmitter.emit(jobs.Request.internalReady)
    onReady()
  })

  client.onNotification(jobs.Request.internalFinishedJob, () => {
    // only one job runs at once, so currently not trying to distinguish
    eventEmitter.emit(jobs.Request.internalFinishedJob)
  })

  client.onNotification(jobs.Request.internalFinishedAllJobs, () =>
    eventEmitter.emit(jobs.Request.internalFinishedAllJobs),
  )

  client.onNotification(jobs.Request.internalDiagnostics, ({ status, result }) => {
    if (getUserConfiguration().clearOutput.enabled) {
      flixLspTerminal.clear()
    }

    // Check if there are any errors
    const hasErrors = result.some(res => res.diagnostics.some(diag => diag.severity <= 2))

    if (!hasErrors) {
      // Only print success message after ready message has been shown
      // This avoids showing "Program compiles successfully" before "Flix Ready"
      if (hasReceivedReadyMessage) {
        flixLspTerminal.writeLine('\x1b[32m' + USER_MESSAGE.COMPILE_SUCCESS() + '\x1b[0m')
      }
    } else {
      for (const res of result) {
        for (const diag of res.diagnostics) {
          if (diag.severity <= 2) {
            flixLspTerminal.writeLine(diag.fullMessage)
          }
        }
      }
    }
  })

  client.onNotification(jobs.Request.internalMessage, (message: string) => {
    hasReceivedReadyMessage = true
    flixLspTerminal.writeLine('\x1b[34m' + message + '\x1b[0m')
    vscode.window.showInformationMessage(message)
  })

  client.onNotification(jobs.Request.internalRecompiling, () => {
    if (hasReceivedReadyMessage) {
      flixLspTerminal.writeLine('\x1b[38;5;172m' + USER_MESSAGE.RECOMPILING() + '\x1b[0m')
    }
  })

  client.onNotification(jobs.Request.internalError, handleError)

  client.onNotification(jobs.Request.lspShowAst, handleShowAst)
}
