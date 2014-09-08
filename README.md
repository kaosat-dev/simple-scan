simple-scan
===========

experimental user interface for fabscan 3D laser scanner,
using node.js, opencv, polymer, socket.io, three.js etc


For now, server side requires gnode https://github.com/TooTallNate/gnode


running simple-scan
-------------------

      gnode --expose-gc src/server.js


notes
-----

because of a memory leaks in node-opencv's videocapture you have to add the --expose-gc flag (see command above)

then go to your browser at http://localhost:8080/

voila !


desktop version is comming soon(ish)


tests
-----

you can run the tests with (depending on your path)

      gnode /usr/local/bin/jasmine-node specs/
