// Blank line

eff Rewind {
    pub def save(label: String): Unit
    /// If you rewind to a non-saved label, it is like throwing an exception.
    pub def rewind(label: String): Unit
}

/// We want to find a number that is:
/// 1. less than k
/// 2. non-negative
/// 3. not divisible by 2 (so not 0, 2, 4, 6, 8, ...)
/// 4. not divisible by 3 (so not 0, 3, 6, 9, ...)
/// And we will this by guessing and retrying
def search(k: Int32): Int32 \ Rewind + IO = {
    println("Beginning to search!");
    let random = Random.freshWithSeed(123i64);
    do Rewind.save("start");
    let guess = Random.nextNatWithMax(random, k);
    // 1. and 2. hold automatically
    if (Int32.modulo(guess, 2) == 0) {println("retry for ${guess}"); do Rewind.rewind("start"); ?unreachable}
    // now 3. holds
    else if (Int32.modulo(guess, 3) == 0) {println("retry for ${guess}"); do Rewind.rewind("start"); ?unreachable}
    // now 4. holds and we can return
    else guess
}
