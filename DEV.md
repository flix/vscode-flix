# Notes for developers

Run `npm install` first.

## Debugging

Open the project in VSCode and find the menu `Run -> Start Debugging (F5)`. 
This will initiate a debugging scheme called `Client + Server` which you can change in the *Run* command palette (usually Ctrl+Shift+D).
If you make changes to the code you need to restart the `Launch Client` (see *Call Stack*).

You can set breakpoints in the compiled code, e.g. `server/out/server.js`.

## Known oddities

* Can't connect to debug target
  * This can happen if the file that gets opened in the debug windows isn't with a `.flix` extension
