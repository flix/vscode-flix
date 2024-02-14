import { FlixRelease } from '../services/releases'

export class USER_MESSAGE {
  static ASK_DOWNLOAD_NEW_FLIX(releaseName: string) {
    return {
      msg: `A new version of the Flix compiler (${releaseName}) is available. Download?`,
      option1: 'Download',
      option2: 'Skip',
    }
  }

  static ASK_DOWNLOAD_RETRY(errorMsg: string) {
    return {
      msg: `Failed to download: ${errorMsg}`,
      option1: 'Retry download',
      option2: 'Dismiss',
    }
  }

  static ASK_PROGRAM_ARGS() {
    return {
      prompt: 'Enter arguments separated by spaces',
      placeHolder: 'arg0 arg1 arg2 ...',
    }
  }

  static ASK_RELOAD_TOML() {
    return {
      msg: 'The flix.toml file has changed. Do you want to restart the compiler?',
      option1: 'Yes',
      option2: 'No',
    }
  }

  static ASK_SAVE_CHANGED_FILES() {
    return {
      msg: 'The workspace contains unsaved files. Do you want to save?',
      option1: 'Run without saving',
      option2: 'Save all and run',
    }
  }

  static CANT_SHOW_AST() {
    return 'Failed to show the AST for this file'
  }

  static INFORM_DOWNLOAD_FLIX() {
    return 'Downloading Flix Compiler'
  }

  static INFORM_NO_CHANGELOG() {
    return (
      'Unable to get latest changelog.\n' +
      'Please visit https://github.com/flix/flix/releases for more information on the available flix releases.'
    )
  }

  static INFORM_STARTING_FLIX() {
    return 'Starting Flix'
  }

  static SHOW_CHANGELOG(installedVersion: FlixRelease) {
    return (
      `# New Flix Release!\n` +
      `## Version: ${installedVersion.version.major}.${installedVersion.version.minor}.${installedVersion.version.patch}\n` +
      `${installedVersion.description}`
    )
  }

  static TIMEOUT(timeMS: number) {
    return `Timeout after ${timeMS}ms`
  }

  static FILE_NOT_PART_OF_PROJECT() {
    return `Flix will only load source files from \`*.flix\`, \`src/**\`, and \`test/**\``
  }
}
