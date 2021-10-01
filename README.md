<p align="center" >
    <img src="https://raw.githubusercontent.com/flix/flix/master/docs/logo.png" height="91px" 
    alt="The Flix Programming Language" 
    title="The Flix Programming Language">
</p>

# Flix for Visual Studio Code

The official Visual Studio Code extension for the [Flix Programming Language
(flix.dev)](https://flix.dev/). 

Flix is a next-generation reliable, safe, concise, and functional-first
programming language.

We aim to have world-class Visual Studio Code support and our extension is based
on the real Flix compiler infrastructure. 

## Features

* __Syntax Highlighting__
  - Code highlighting for *.flix files.

* __Diagnostics__
  - Compiler error messages. 

* __Auto-complete__
  - Auto-complete as you type.

* __Snippets__
  - Auto-complete common code constructs.

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
    - Find all references to a function.
    - Find all references to a local variable or formal parameter.
    - Find all references to an enum case.

* __Symbols__
    - List all document symbols.
    - List all workspace symbols.

* __Rename__
    - Rename local variables or formal parameters.
    - Rename functions.

* __Code Lenses__
    - Run `main` from within the editor.
    - Run benchmarks and unit tests from within the editor.

* __Highlight__
    - Highlights semantically related symbols.

## Color Theme

* __Flixify Dark__
    - The extension comes with a dark color theme specifically designed for Flix named 'Flixify Dark'.
    - The color theme can be enabled in `File -> Preferences -> Color Theme`.

## Installation

- Install the Flix Visual Studio Code extension.
    - The extension will automatically download the Flix compiler.

Alternative (for advanced users):

- Upon startup, the extension with look for a `flix.jar` compiler in the project
  root and use that if available. 
  - This can be used to run a nightly (or custom-built) version of the compiler.

## Requirements

- Requires Java 11 (or later).
    - Ensure that the `java` command is on your path. 

## For Developers

Information about running, debugging, and packaging the extension is available in [DEV.md](DEV.md).
