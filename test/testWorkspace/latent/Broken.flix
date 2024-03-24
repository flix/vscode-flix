// This file is intentionally broken for use in the error tests.

/// We can easily construct and append lists:
def l(): List[Int32] =
    let l1 = 1 :: 2 :: 3 :: Nil;
    let l2 = 4 :: 5 :: 6 :: Nil // <- Missing semi-colon
    l1 ::: l2
