const path = require('path')
const ChildProcess = require('child_process')
const _ = require('lodash/fp')

const noJavaHomePath: string = ""

export default async function javaMajorVersion (rootPath: string): Promise<string> {
  return new Promise((resolve) => {
    ChildProcess.exec('java -cp . CheckJAVA_HOME', { cwd: path.join(rootPath, 'java') }, (error: any, stdout: any, stderror: any) => {
      if (error) {
        return resolve(noJavaHomePath)
      }
      if (typeof stdout != "string" || String(stdout).length <= 6) {
        // This happends if the path is undefined or "null"
        return resolve(noJavaHomePath)
      }
      return resolve(stdout)
    })
  })
}
