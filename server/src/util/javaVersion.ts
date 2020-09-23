const path = require('path')
const ChildProcess = require('child_process')
const _ = require('lodash/fp')

const getMajorVersion = _.flow(
  _.split('.'),
  _.first,
  _.parseInt(10)
)

export default async function javaMajorVersion (rootPath: string): Promise<number> {
  return new Promise((resolve) => {
    ChildProcess.exec('java CheckJavaVersion', { cwd: path.join(rootPath, 'java') }, (error: any, stdout: any, stderror: any) => {
      if (error) {
        return resolve(0)
      }
      if (typeof stdout !== 'string') {
        return resolve(0)
      }
      const majorVersion = getMajorVersion(stdout) || 0
      return resolve(majorVersion)
    })
  })
}
