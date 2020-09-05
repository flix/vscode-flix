import { TextDocumentPositionParams, CompletionItem, CompletionItemKind } from 'vscode-languageserver'

// This handler provides the initial list of the completion items.
export function handleCompletion (textDocumentPosition: TextDocumentPositionParams): CompletionItem[] {
	console.log('connection.onCompletion', textDocumentPosition)
	// The pass parameter contains the position of the text document in
	// which code complete got requested. For the example we ignore this
	// info and always provide the same completion items.
	return [
		{
			label: 'TypeScript',
			kind: CompletionItemKind.Text,
			data: 1
		},
		{
			label: 'JavaScript',
			kind: CompletionItemKind.Text,
			data: 2
		}
	]
}

// This handler resolves additional information for the item selected in
// the completion list.
export function handleCompletionResolve (item: CompletionItem): CompletionItem {
	console.log('connection.onCompletionResolve', item)
	if (item.data === 1) {
		item.detail = 'TypeScript details'
		item.documentation = 'TypeScript documentation'
	} else if (item.data === 2) {
		item.detail = 'JavaScript details'
		item.documentation = 'JavaScript documentation'
	}
	return item
}
