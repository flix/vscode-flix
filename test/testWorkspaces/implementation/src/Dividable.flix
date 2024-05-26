
eff DivByZero {
    pub def throw(): Void
}

trait Dividable[t] {
    type Aef: Eff
    pub def div(x: t, y: t): t \ Dividable.Aef[t]
}

instance Dividable[Int32] {
    type Aef = DivByZero
    pub def div(x: Int32, y: Int32): Int32 \ DivByZero = 
        if (y == 0) do DivByZero.throw() else x / y
}
