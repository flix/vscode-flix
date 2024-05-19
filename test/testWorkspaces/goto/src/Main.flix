
/// An algebraic data type for shapes.
enum Shape {
    case Circle(Int32),          // circle radius
    case Square(Int32),          // side length
    case Rectangle(Int32, Int32) // height and width
}

/// Computes the area of a 2 by 4.
def main(): Unit \ IO =
    println(area(Shape.Rectangle(2, 4)))
