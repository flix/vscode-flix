// Blank line
trait Equatable[t] {
    pub def equals(x: t, y: t): Bool
}

instance Equatable[Option[t]] with Equatable[t] {
    pub def equals(x: Option[t], y: Option[t]): Bool = 
        match (x, y) {
            case (None, None)         => true
            case (Some(v1), Some(v2)) => Equatable.equals(v1, v2)
            case _                    => false
        }
}

instance Equatable[Int32] {
    pub def equals(x: Int32, y: Int32): Bool = x == y
}

@Test
def testOptionEquatable01(): Bool = {
    let first = Some(1);
    let second = Some(1);
    Equatable.equals(first, second)
}

@Test
def testOptionEquatable02(): Bool = {
    let first: Option[Int32] = None;
    let second: Option[Int32] = None;
    Equatable.equals(first, second)
}

@Test
def testOptionEquatable03(): Bool = {
    let first = Some(1);
    let second: Option[Int32] = None;
    not Equatable.equals(first, second)
}

@Test
def testOptionEquatable04(): Bool = {
    let first = Some(1);
    let second = Some(2);
    not Equatable.equals(first, second)
}
