// Contains a typematch with no default case.

def typeOf(v: t): String = typematch v {
    case _: Int32 => "Int32"
    case _: Int64 => "Int64"
    case _: Float32 => "Float32"
    case _: Float64 => "Float64"
}
