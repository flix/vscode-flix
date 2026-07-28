// Contains a function which is never used, and in which the name 'x' is shadowed.

def unusedFunction(): Int32 =
    let x = 1;
    match Some(2) {
        case Some(x) => x
        case None    => x
    }
