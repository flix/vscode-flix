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

import * as vscode from 'vscode'
import { USER_MESSAGE } from '../util/userMessages'

const _ = require('lodash/fp')

// incrementing index to use as keys for resolver maps
let indexCounter = 0

// maintain a list of resolve functions to run when cleaning up
let resolversToCleanUp = {
  // idx -> { timer, resolver }
}

/**
 * Ensures the `resolver` is called eventually. Returns a function that should be called if everything works out.
 * 
 * @param resolver {Function} Function to call with no arguments eventually unless canceled
 * @param timeout {Number} Optional time to wait until bailing out
 * @returns {Function} Function that should be called when things work out
 */
export function ensureCleanupEventually (resolver, timeout = 180) {
  const index = `${indexCounter++}`
  const timer = setTimeout(() => {
    const msg = USER_MESSAGE.TIMEOUT(timeout)
    vscode.window.showErrorMessage(msg)
    resolver()
  }, timeout * 1000)
  resolversToCleanUp[index] = {
    timer,
    resolver
  }
  return function cancelCleanupCrew () {
    const resolverMap = resolversToCleanUp[index]
    if (resolverMap) {
      clearTimeout(resolverMap.timer)
    }
    delete resolversToCleanUp[index]
  }
}

/**
 * Empty the map of resolvers, clearing their timeouts and calling each resolver.
 */
export function callResolversAndEmptyList () {
  _.each(({ timer, resolver }) => {
    clearTimeout(timer)
    resolver()
  }, resolversToCleanUp)
  resolversToCleanUp = {}
}
