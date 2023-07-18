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

const path = require('path')
const ChildProcess = require('child_process')
const _ = require('lodash/fp')

interface JavaVersion {
  majorVersion: number | undefined
  versionString: string | undefined
}

const unknownJavaVersion: JavaVersion = {
  majorVersion: undefined,
  versionString: undefined,
}

const getMajorVersion = _.flow(_.split('.'), _.first, _.parseInt(10))

export default async function javaMajorVersion(rootPath: string): Promise<JavaVersion> {
  return new Promise(resolve => {
    ChildProcess.exec(
      'java -cp . CheckJavaVersion',
      { cwd: path.join(rootPath, 'java') },
      (error: any, stdout: any, stderror: any) => {
        if (error) {
          return resolve(unknownJavaVersion)
        }
        if (typeof stdout !== 'string') {
          return resolve(unknownJavaVersion)
        }
        const majorVersion = getMajorVersion(stdout) || 0
        return resolve({
          majorVersion,
          versionString: _.trim(stdout),
        })
      },
    )
  })
}
