// Blank line
trait Dividable[t] {
    pub def div(x: t, y: t): t
}

instance Dividable[Int32] {
    pub def div(x: Int32, y: Int32): Int32 = 
        x / y
}
