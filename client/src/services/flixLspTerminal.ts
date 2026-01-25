import * as vscode from 'vscode'

export class FlixLspTerminal implements vscode.Pseudoterminal {
  private writeEmitter = new vscode.EventEmitter<string>()
  onDidWrite: vscode.Event<string> = this.writeEmitter.event

  open(): void {}

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
