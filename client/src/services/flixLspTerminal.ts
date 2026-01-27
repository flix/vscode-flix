/*
 * Copyright 2026 Magnus Madsen
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as vscode from 'vscode'
import { USER_MESSAGE } from '../util/userMessages'

export class FlixLspTerminal implements vscode.Pseudoterminal {
  private writeEmitter = new vscode.EventEmitter<string>()
  onDidWrite: vscode.Event<string> = this.writeEmitter.event

  open(): void {
    this.writeLine('\x1b[38;5;208m' + USER_MESSAGE.COMPILER_STARTING() + '\x1b[0m')
  }

  clear(): void {
    // ANSI escape code to clear screen and move cursor to top-left
    this.writeEmitter.fire('\x1b[2J\x1b[H')
  }

  close(): void {}

  handleInput(): void {
    // Ignore user input
  }

  public writeLine(message: string): void {
    // Replace \n with \r\n for proper terminal line handling
    const formatted = message.replace(/\r?\n/g, '\r\n')
    this.writeEmitter.fire(formatted + '\r\n')
  }
}
