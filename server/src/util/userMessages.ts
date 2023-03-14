export class USER_MESSAGE {

    static COMPILER_CRASHED() { 
        return 'The flix compiler crashed. See the crash report for details'
    }

    static CONNECTION_ESTABLISHED(version:any, engine:any) { 
        const { major, minor, revision } = version
        return `Flix ${major}.${minor}.${revision} Ready! (Extension: ${engine.getExtensionVersion()}) (Using ${engine.getFlixFilename()})`
    }

    static CONNECTION_LOST() {
        return "Connection to the flix server was lost, trying to reconnect..."
    }

    static CONNECTION_LOST_RESTARTING() {
        return "Failed to connect to the flix server, restarting the compiler..."
    } 

    static FAILED_TO_START() {
        return "Failed starting Flix"
    }

    static FAILED_TO_READ_FILE(filePath:string, err:any) { 
        return `Could not read file (${filePath}) in queue. \nError: ${err}` 
    }

    static FILE_NOT_AVAILABLE(targetUri:string) { 
        return `Source for: '${targetUri}' is unavailable.` 
    }

    static JAVA_NOT_FOUND() { 
        return "Unable to find java on PATH. Please check that Java is correctly installed and on your PATH"
    }

    static JAVA_WRONG_VERSION(foundVersion:string) { 
        return `Flix requires Java 11 or later. Found "${foundVersion}".` 
    }
    
    static RESPONSE_TIMEOUT(timeoutTime:number) { 
        return `Job timed out after ${timeoutTime} seconds` 
    }

    static REQUEST_TIMEOUT(retries:number) { 
        return `Could not send message after ${retries} retries. Websocket not available.` 
    }

}