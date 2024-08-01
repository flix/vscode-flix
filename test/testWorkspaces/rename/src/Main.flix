// Blank line
/// An algebraic data type for shapes.
enum Shape {
    case Circle(Int32),          // circle radius
    case Square(Int32),          // side length
    case Rectangle(Int32, Int32) // height and width
}

/// Computes the area of a 2 by 4.
def main(): Unit \ IO =
    println(area(Shape.Rectangle(2, 4)))

def f(): Shape \ IO = println("Hello World"); Shape.Circle(5)

instance ToString[Shape] {
    pub def toString(s: Shape): String =
        match s {
            case Shape.Circle(r)       => "Circle(${r})"
            case Shape.Square(w)       => "Square(${w})"
            case Shape.Rectangle(h, w) => "Rectangle(${h}, ${w})"
        }
}
