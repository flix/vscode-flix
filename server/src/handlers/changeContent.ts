import { TextDocument } from 'vscode-languageserver'

import * as jobs from '../engine/jobs'

export function handleChangeContent (listener: any) {
  const document: TextDocument = listener.document
  const job: jobs.Job = {
    request: 'lsp/check',
    uri: document.uri,
    src: document.getText()
  }
  jobs.enqueue(job)
}
