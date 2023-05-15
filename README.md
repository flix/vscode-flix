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

Flix aims to have world-class Visual Studio Code support and our extension is
based on the real Flix compiler infrastructure.

## Features

* __Semantic Syntax Highlighting__
    - Code highlighting for *.flix files. This work best with the [official vscode theme](https://marketplace.visualstudio.com/items?itemName=flix.flixify-dark).

* __Diagnostics__
    - Compiler error messages.

* __Auto-complete__
    - Auto-complete as you type.
    - Auto-completion is context aware.
    - Type-directed completion of program holes.

* __Snippets__
    - Auto-complete common code constructs.

* __Inlay Hints__
    - Shows inline type information.

* __Type and Effect Hovers__
    - Hover over any expression to see its type and effect.
    - Hover over any local variable or formal parameter to see its type.
    - Hover over any function to see its type signature and documentation.

* __Jump to Definition__
    - Jump to the definition of any function.
    - Jump to the definition of any local variable or formal parameter.
    - Jump to the definition of any enum case.

* __Find References__
    - Find all references to a function.
    - Find all references to a local variable or formal parameter.
    - Find all references to an enum case.
    - Find all implementations of a type class.

* __Symbols__
    - List all document symbols.
    - List all workspace symbols.

* __Rename__
    - Rename local variables or formal parameters.
    - Rename functions.

* __Code Lenses__
    - Run `main` from within the editor.
    - Run tests from within the editor.

* __Highlight__
    - Highlights semantically related symbols.

* __Semantic Tokens__
    - Additional code highlighting hints provided by the compiler.

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
