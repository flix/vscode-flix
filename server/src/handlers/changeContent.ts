import { TextDocument } from 'vscode-languageserver-textdocument'

import * as jobs from '../engine/jobs'
import * as queue from '../engine/queue'

export function handleChangeContent (listener: any) {
  const document: TextDocument = listener.document
  const job: jobs.Job = {
    request: jobs.Request.apiAddUri,
    uri: document.uri, // Note: this typically has the file:// scheme (important for files as keys)
    src: document.getText()
  }
  queue.enqueue(job)
  queue.enqueue(jobs.createCheck())
}
