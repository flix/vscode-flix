const path = require('path')
const ChildProcess = require('child_process')
const _ = require('lodash/fp')

interface JavaVersion {
  majorVersion: number
  versionString: string
}

const unknownJavaVersion: JavaVersion = {
  majorVersion: 0,
  versionString: 'unknown version'
}

const getMajorVersion = _.flow(
  _.split('.'),
  _.first,
  _.parseInt(10)
)

export default async function javaMajorVersion (rootPath: string): Promise<JavaVersion> {
  return new Promise((resolve) => {
    ChildProcess.exec('java CheckJavaVersion', { cwd: path.join(rootPath, 'java') }, (error: any, stdout: any, stderror: any) => {
      if (error) {
        return resolve(unknownJavaVersion)
      }
      if (typeof stdout !== 'string') {
        return resolve(unknownJavaVersion)
      }
      const majorVersion = getMajorVersion(stdout) || 0
      return resolve({
        majorVersion,
        versionString: stdout
      })
    })
  })
}
