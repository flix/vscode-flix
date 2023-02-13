export class USER_MESSAGE {
    static readonly unabled_to_find_java  = "Unable to find java on PATH. Please check that Java is correctly installed and on your PATH"
    
    static readonly lost_connection  = "Connection to the flix server was lost, trying to reconnect..."

    static readonly failed_to_connect_restarting  = "Failed to connect to the flix server, restarting the compiler..."

    static readonly failed_to_start  = "Failed starting Flix"

    static required_java_version(foundVersion:string) { return `Flix requires Java 11 or later. Found "${foundVersion}".` }
    
    static failed_to_read_file(filePath:string, err:any) { return `Could not read file (${filePath}) in queue. \nError: ${err}` }

    static ws_not_available(retries:number) { return `Could not send message after ${retries} retries. Websocket not available.` }

    static job_timed_out(timeoutTime:number) { return `Job timed out after ${timeoutTime} seconds` }

    static src_is_unavailable(targetUri:string) { return `Source for: '${targetUri}' is unavailable.` }

    static flix_ready_msg(version:any, engine:any) { 
        const { major, minor, revision } = version
        return `Flix ${major}.${minor}.${revision} Ready! (Extension: ${engine.getExtensionVersion()}) (Using ${engine.getFlixFilename()})`
    }


}