mod JavaStringBuilder {
    import java.lang.StringBuilder;

    pub def create(): StringBuilder \ IO =
        new StringBuilder()

    pub def append(s: String, builder: StringBuilder): StringBuilder \ IO =
        builder.a

    pub def toString(builder: StringBuilder): String \ IO =
        builder.toString()
        
    pub def dummmy(builder: StringBuilder): Unit \ IO =
        builder.s
        ()
}