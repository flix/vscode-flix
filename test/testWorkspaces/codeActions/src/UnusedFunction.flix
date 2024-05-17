mod Reachable.Logic {
    def reachable(origin: n, edges: f[(n, n)]): Set[n] with Foldable[f], Order[n] =
        let edgeFacts = inject edges into Edge;
        // origin is reachable and this set is expanded by the edge facts
        let reachable = #{
            Reachable(origin).
            Reachable(end) :- Reachable(start), Edge(start, end).
        };
        query edgeFacts, reachable select x from Reachable(x) |> Vector.toSet
}

mod Graphs {
    pub def graph1(): Set[(Int32, Int32)] = Set#{}

    pub def graph2(): Set[(Int32, Int32)] = Set#{
        (1, 2), (2, 3), (3, 4), (4, 1)
    }

    pub def graph3(): Set[(Int32, Int32)] = Set#{
        (1, 2), (1, 3), (4, 5)
    }

    pub def graph4(): Set[(Int32, Int32)] = Set#{
        (2, 3), (3, 4)
    }

    pub def graph5(): Set[(Int32, Int32)] = Set#{
        (4, 5), (5, 6), (4, 3), (4, 2), (12, 13), (29, 4)
    }

    pub def validate(reachable: Int32 -> Set[(Int32, Int32)] -> Set[Int32]): Bool = {
        let test1 = reachable(42, Graphs.graph1()) == Set#{42};
        let test2 = reachable(1, Graphs.graph2()) == Set#{1, 2, 3, 4};
        let test3 = reachable(1, Graphs.graph3()) == Set#{1, 2, 3};
        let test4 = reachable(1, Graphs.graph4()) == Set#{1};
        let test5 = reachable(4, Graphs.graph5()) == Set#{2, 3, 4, 5, 6};
        test1 and test2 and test3 and test4 and test5
    }
}
