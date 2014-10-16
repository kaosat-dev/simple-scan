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



desktop version
---------------

- build custom elements (manually for now, script coming up)


  vulcanize simple-scan.html



- notes on gyp modules:

 - the version that need to be compiled are different based on running the server part in 
node-main (option in package.json) or withing the main index.html


- gyp modules that need to be rebuild usin nw-gyp:

 * node_modules/socket.io/node_modules/engine.io/node_modules/ws
 * node_modules/socket.io/node_modules/socket.io-client/node_modules/engine.io-client/node_modules/ws
 * node_modules/serialport

For all the above do :
  - nw-gyp configure --target=0.10.5
  - nw-gyp build

Or rather (better): use BUILD instead of REBUILD as it clears the build folder of other builds

        node-pre-gyp build --runtime=node-webkit --target=0.10.5
        
        node-pre-gyp build --runtime=node


          pushd node_modules/socket.io/node_modules/engine.io/node_modules/ws
            node-pre-gyp rebuild --runtime=node-webkit --target=0.10.5
            node-pre-gyp rebuild --runtime=node --target=0.10.30 
          popd

          pushd node_modules/socket.io/node_modules/socket.io-client/node_modules/engine.io-client/node_modules/ws
            node-pre-gyp rebuild --runtime=node-webkit --target=0.10.5
            node-pre-gyp rebuild --runtime=node --target=0.10.30 
          popd

          pushd node_modules/serialport
            node-pre-gyp build --runtime=node-webkit --target=0.10.5
            node-pre-gyp build --runtime=node 
          popd

          pushd node_modules/opencv
            node-pre-gyp build --runtime=node-webkit --target=0.10.5
            node-pre-gyp build --runtime=node
          popd



tests
-----

you can run the tests with (depending on your path)

      gnode /usr/local/bin/jasmine-node specs/
