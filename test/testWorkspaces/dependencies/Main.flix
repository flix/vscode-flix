// Blank line
/// Enqueues a single element and prints the size of the resulting queue.
///
/// `Extras.Queue` is not defined anywhere in this workspace: it comes from the
/// `github:flix/extras` dependency declared in the `flix.toml` which this suite
/// puts in the active workspace.
def main(): Unit \ IO =
    let q = Extras.Queue.empty();
    let q2 = Extras.Queue.enqueue /*!enqueue*/(42, q);
    println(Extras.Queue.size /*!size*/(q2))
