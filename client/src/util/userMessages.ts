import { FlixRelease } from '../services/releases'

export class USER_MESSAGE {
    static readonly save_unsaved_files  = {
        msg: 'The workspace contains unsaved files. Do you want to save?',
        option1: 'Run without saving',
        option2: 'Save all and run'
    }

    static readonly reload_on_flixtoml_change  = {
        msg: 'The flix.toml file has changed. Do you want to restart the compiler?',
        option1: 'Yes',
        option2: 'No'
    }

    static readonly ask_for_space_seperated_args = {
        prompt: 'Enter arguments separated by spaces',
        placeHolder: 'arg0 arg1 arg2 ...',
    }

    static readonly downloading_flix_compiler  = 'Downloading Flix Compiler'
    static readonly starting_flix  = 'Starting Flix'

    static timeout_message(timeMS:number) { return `Timeout after ${timeMS}ms` }

    static new_flix_release_desc(installedVersion:FlixRelease) { 
        return `# New Flix Release!\n` 
        + `## Version: ${installedVersion.version.major}.${installedVersion.version.minor}.${installedVersion.version.patch}\n`
        + `${installedVersion.description}`
     }

    static readonly no_changelog_found = 'Unable to get latest changelog.\n'
    + 'Please visit https://github.com/flix/flix/releases for more information on the available flix releases.'


    static offer_new_version(releaseName:string) {
        return {
            msg: `A new version of the Flix compiler (${releaseName}) is available. Download?`,
            option1: 'Download',
            option2: 'Skip'
        }
    }

    static failed_to_download_offer_retry(errorMsg:string) {
        return {
            msg: `Failed to download: ${errorMsg}`,
            option1: 'Retry download',
            option2: 'Dismiss'
        }
    }

}