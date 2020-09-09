import { TextDocument } from 'vscode-languageserver'
import { validate } from '../engine'

export function handleChangeContent (listener: any) {
  const document: TextDocument = listener.document
  validate({ 
    uri: document.uri,
    src: document.getText()
  })
}
