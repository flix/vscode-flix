<p align="center" >
    <img src="https://raw.githubusercontent.com/flix/flix/master/doc/logo.png" height="91px" 
    alt="The Flix Programming Language" 
    title="The Flix Programming Language">
</p>

# Flix for Visual Studio Code

The **official** Visual Studio Code extension for the [Flix Programming Language
(flix.dev)](https://flix.dev/). 

Flix is a next-generation reliable, safe, concise, and functional-first
programming language.

## Features

* __Syntax Highlighting__
  - Code highlighting for *.flix files.

* __Diagnostics__
  - Compiler error messages. 

* __Type and Effect Hovers__
  - Hover over any expression to see its type and effect.
  - Hover over any local variable or formal parameter to see its type.
  - Hover over any function to see its type signature and documentation.
  - Hover over any first-class Datalog constraint expression to see its stratification.

* __Jump to Definition__
  - Jump to the definition of any function.
  - Jump to the definition of any local variable or formal parameter.
  - Jump to the definition of any enum case.

* __Find References__
    - Find all references to uses of a specific function.
    - Find all references to uses of a local variable or formal parameter.
    - Find all references to uses of an enum case.

* __Code Lenses__
    - Run main from within the editor.
    - Run benchmarks and unit tests from within the editor.

* __Highlight__
    - Highlights semantically related symbols, not simply symbols that share the same name.

## Installation

- Install the Flix Visual Studio Code extension.
- Upon startup, the extension will automatically download the newest version of the Flix compiler to local storage.

Alternative (for advanced users):

- If you place the Flix compiler, which must be named `flix.jar`, into the project root then the extension will use that instead its internal version. This should only be used if you want to run a nightly build or a custom version of the compiler.

## Requirements

- Must have Java 11 (or later) installed.
- Must have `java` on your path.

## For Developers

Information about running, debugging, and packaging the extension is available in [DEV.md](DEV.md).
