This is a simple program that prints the Java version.

It needs to be compiled for older versions of the JVM to run universally. The `class` file is compiled using:

```
javac -source 7 -target 7 CheckJavaVersion.java
```

The number 7 is chosen because my compiler can't go lower.
