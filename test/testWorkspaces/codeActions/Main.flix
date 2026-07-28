// Blank line
def main(): Unit \ IO = {

    // Unused local variable
    let a = "Hej, ";

    match None {
        // Unused match variable
        case Some(b) => println("Pozdravljen, ")
        case None => println("Hello, ")
    };

    println("World!")
}
