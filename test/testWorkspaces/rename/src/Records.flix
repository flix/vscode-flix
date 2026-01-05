// Blank line
/// Returns the record `r` with a new value of its `x` label.
def setX(r: {x = Int32, y = Int32}, v: Int32): {x = Int32, y = Int32} =
    { x = v | r }

/// Returns the record `r` with a new value of its `y` label.
/// Preserves (retains) all other labels polymorphically.
def setY(r: {y = Int32 | a}, v: Int32): {y = Int32 | a} =
    { y = v | r }


@Test
def testRecords(): Unit \ Assert =
    let r1 = {x = 1, y = 2};
    let r2 = setX(r1, 3);
    Assert.assertEq(expected = 4, r1#x + r2#x)
