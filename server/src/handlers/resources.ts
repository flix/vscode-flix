/*
 * Copyright 2020 Thomas Plougsgaard
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

import { TextDocumentChangeEvent } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'

import * as jobs from '../engine/jobs'
import * as engine from '../engine'

import { sendNotification } from '../server'
import { makeEnqueuePromise } from './util'

interface UriInput {
  uri: string
}

export function handleAddUri({ uri }: UriInput) {
  engine.addUri(uri)
}

export function handleRemUri({ uri }: UriInput) {
  engine.remUri(uri)
}

export function handleAddPkg({ uri }: UriInput) {
  engine.addPkg(uri)
}

export function handleRemPkg({ uri }: UriInput) {
  engine.remPkg(uri)
}

export function handleAddJar({ uri }: UriInput) {
  engine.addJar(uri)
}

export function handleRemJar({ uri }: UriInput) {
  engine.remJar(uri)
}

export function handleReplaceConfiguration(userConfiguration: engine.UserConfiguration) {
  engine.updateUserConfiguration(userConfiguration)
}

export function handleChangeContent(params: TextDocumentChangeEvent<TextDocument>) {
  const document = params.document
  engine.updateUri(document.uri, document.getText())
}

export const handleShowAst = makeEnqueuePromise(makeShowAstJob, makeShowAstResponseHandler)

function makeShowAstJob(params: any) {
  return {
    request: jobs.Request.lspShowAst,
    uri: params.uri,
    phase: params.phase,
  }
}

function makeShowAstResponseHandler(promiseResolver: () => void) {
  return function responseHandler({ status, result }: any) {
    sendNotification(jobs.Request.lspShowAst, { status, result })
    promiseResolver()
  }
}
