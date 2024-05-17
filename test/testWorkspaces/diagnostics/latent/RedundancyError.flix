// Contains a function in which the name 'file' is shadowed.

def printFile(file: String): Unit \ IO = {
    match Files.readLines(file) {
        case Ok(file) => println(file)
        case Err(msg)   => println("An error occurred with message: ${msg}")
    }
}
