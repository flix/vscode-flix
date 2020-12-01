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

import * as path from 'path'
import * as fs from 'fs'

export default function ensureTargetWritable (workspaceFolder: string): boolean {
  try {
    const targetPath = path.join(workspaceFolder, 'target')
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath)
    }
    fs.accessSync(targetPath, fs.constants.W_OK)
    return true
  } catch (err) {
    console.warn('Target is not writable.', err)
    return false
  }
}
