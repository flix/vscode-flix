// Contains two function with the same name.

def sum(a: Int32, b: Int32): Int32 = a + b

def sum(l: List[Int32]): Int32 = Foldable.sum(l)
