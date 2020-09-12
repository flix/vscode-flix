import { TextDocument } from 'vscode-languageserver'

import * as jobs from '../engine/jobs'
import * as queue from '../engine/queue'

export function handleChangeContent (listener: any) {
  const document: TextDocument = listener.document
  const job: jobs.Job = {
    request: jobs.Request.addUri,
    uri: document.uri,
    src: document.getText()
  }
  queue.enqueue(job)
}
