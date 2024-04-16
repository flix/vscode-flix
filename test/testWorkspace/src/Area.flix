
/// Computes the area of the given shape using
/// pattern matching and basic arithmetic.
def area(s: Shape): Int32 = {
    import static dev.flix.SquareArea.squareArea(Int32): Int32 \ {};
    match s {
        case Shape.Circle(r)       => circleArea(r)
        case Shape.Square(w)       => squareArea(w)
        case Shape.Rectangle(h, w) => h * w
    }
}
