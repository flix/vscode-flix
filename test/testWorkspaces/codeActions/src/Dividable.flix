// Blank line
trait Dividable[t] {
    type Aef: Eff
    pub def div(x: t, y: t): t \ Dividable.Aef[t]
}

mod Dividable {
    // Unused effect
    eff DivByZero {
        def raise(): Void
    }
}
