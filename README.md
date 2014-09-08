simple-scan
===========

experimental user interface for fabscan 3D laser scanner,
using node.js, opencv, polymer, socket.io, three.js etc


For now, server side requires gnode https://github.com/TooTallNate/gnode


running simple-scan
-------------------

      gnode src/server.js


then go to your browser at http://localhost:8080/

voila !


desktop version is comming soon(ish)



desktop version
---------------

- build custom elements (manually for now, script coming up)


  vulcanize simple-scan.html


- gyp modules that need to be rebuild usin nw-gyp:

 * node_modules/socket.io/node_modules/engine.io/node_modules/ws
 * node_modules/socket.io/node_modules/socket.io-client/node_modules/engine.io-client/node_modules/ws
 * node_modules/serialport

For all the above do :
  - nw-gyp configure --target=0.7.5
  - nw-gyp build

Or rather (better)
  - node-pre-gyp rebuild --runtime=node-webkit --target=0.7.5
  - node-pre-gyp rebuild --runtime=node --target=0.10.30 


pushd node_modules/socket.io/node_modules/engine.io/node_modules/ws
  node-pre-gyp rebuild --runtime=node-webkit --target=0.7.5
  node-pre-gyp rebuild --runtime=node --target=0.10.30 
popd

pushd node_modules/socket.io/node_modules/socket.io-client/node_modules/engine.io-client/node_modules/ws
  node-pre-gyp rebuild --runtime=node-webkit --target=0.7.5
  node-pre-gyp rebuild --runtime=node --target=0.10.30 
popd

//TODO : here we need a symlink, we cannot have both versions at the same time
pushd node_modules/serialport
  node-pre-gyp rebuild --runtime=node-webkit --target=0.7.5
  node-pre-gyp rebuild --runtime=node --target=0.10.30 
popd

pushd node_modules/opencv
  node-pre-gyp rebuild --runtime=node-webkit --target=0.7.5
  node-pre-gyp rebuild --runtime=node --target=0.10.30 
popd



tests
-----

you can run the tests with (depending on your path)

      gnode /usr/local/bin/jasmine-node specs/
