simple-scan
===========

Experimental user interface for the nice and cheap [Fabscan 3D laser scanners](http://hci.rwth-aachen.de/fabscan)
using node.js, opencv, polymer, socket.io, three.js etc etc


This project is based partially on the [Fabscan software](http://hci.rwth-aachen.de/fabscan_software):

- the image analysis and 3d point extraction parts, plus a few others are
base on the c/c++ part code of the original software, were reverse engineered, re-writed in javascript
- the firmware is a slightly modified version of the fabscan firmware (command ack, faster io)
- the UI was created from scratch


Why?
----

- I frankly never managed to get the original software running, and wanted to dwelve a bit
deeper into 3d scanning
- User interface is important, I wanted to whip up something basic, yet useable

Worth noting:
-------------

I only had access to a Fabscan scanner during my work at the SZS in Karlsruhe Germany,
(where this software was born) so my ability to adjust things very specific to a Fabscan are...limited :)


running simple-scan
===================

  There are two distinct versions of simple-scan, with shared code base


desktop app:
------------
  
There are /will be packages/installs for [linux]() / [mac]() / [windows](): 
     
     
  
client/server version:
----------------------
  
  
For now, running the server requires gnode https://github.com/TooTallNate/gnode

    gnode --expose-gc src/server.js


####notes

  because of a memory leak in node-opencv's videocapture you have to add the --expose-gc flag (see command above)

  then go to your browser at 
  
          http://localhost:8080/

  voila !



For developpers:
================


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



 ####tests
  
  There are a few "server" side tests  you can run the tests with (depending on your path)

        gnode node-modules/jasmine-node/bin/jasmine-node specs/
        
License:
========

GPLV3 , see License file
