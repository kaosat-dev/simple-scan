
var sys = require('sys')
var exec = require('child_process').exec;
//function puts(error, stdout, stderr) { sys.puts(stdout) }
//exec("gnode --expose-gc ./server.js ", puts);


/*exec('node_modules/gnode/bin/gnode --expose-gc ./src/server.js', function (error, stdout, stderr) {
  // output is in stdout
    console.log("error", error);
    console.log("out", stdout);
    console.log("err", stderr);
});*/

var gnode = require("gnode");
var server = require("./server.js");

/*
exec('node --expose-gc ./src/server.js', function (error, stdout, stderr) {
  // output is in stdout
    console.log("error", error);
    console.log("out", stdout);
    console.log("err", stderr);
});*/
