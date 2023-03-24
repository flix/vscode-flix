import * as vscode from 'vscode'

export default class codeActions implements vscode.CodeActionProvider {

    public providedCodeActionKinds = []; // Types of code actions: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#codeActionKind
    public newText: string;

    // Constructor changes depending on which properties we need for our code actions
    constructor(kind: string, text: string) {
        this.providedCodeActionKinds.push(kind);
        this.newText = text;
    }

    // Should return a list of all the different code actions
    public provideCodeActions(document: vscode.TextDocument, range: vscode.Range): vscode.CodeAction[] {
		const insertTextCodeAction = this.exampleCodeAction(document, range);
		return [
			insertTextCodeAction 
		];
	}

    // code action example (Inserts the result.edit.newText returned from the server request in the code):
	private exampleCodeAction(document: vscode.TextDocument, range: vscode.Range): vscode.CodeAction {
		const fix = new vscode.CodeAction("Label used for the light bulb menu", this.providedCodeActionKinds[0]);
		fix.edit = new vscode.WorkspaceEdit();
		fix.edit.insert(document.uri, range.start, this.newText);
		return fix;
	}
}