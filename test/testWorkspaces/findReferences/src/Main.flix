/// An algebraic data type for shapes.
enum Shape {
    case Circle(Int32),          // circle radius
    case Square(Int32),          // side length
    case Rectangle(Int32, Int32) // height and width
}

/// Computes the area of the given shape using
/// pattern matching and basic arithmetic.
def area(s /*!s1*/: Shape): Int32 = match s /*!s2*/ {
    case Shape.Circle(r /*!r1*/)       => 3 * (r /*!r2*/ * r)
    case Shape.Square(w)       => w * w
    case Shape.Rectangle(h, w) => h * w
}

// Computes the area of a 2 by 4.
def main(): Unit \ IO =
    println(area(Shape.Rectangle(2, 4)))
