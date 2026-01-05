// Blank line
/// Computes the area of the given shape using
/// pattern matching and basic arithmetic.
def area(s: Shape): Int32 = {
    match s {
        case Shape.Circle(r)       => 3 * r * r
        case Shape.Square(w)       => w * w
        case Shape.Rectangle(h, w) => h * w
    }
}

@Test
def testSquareArea(): Unit \ Assert = Assert.assertEq(expected = 25, area(Shape.Square(5)))
