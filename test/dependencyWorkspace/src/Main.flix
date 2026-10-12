// Blank line
/// Enqueues a single element and prints the size of the resulting queue.
///
/// `Extras.Queue` is not defined anywhere in this workspace: it comes from the
/// `github:flix/extras` dependency declared in `flix.toml`, reached through the
/// package's mount, `extras`.
use extras::Extras.Queue;

def main(): Unit \ IO =
    let q = Queue.empty();
    let q2 = Queue.enqueue /*!enqueue*/(42, q);
    println(Queue.size /*!size*/(q2))
