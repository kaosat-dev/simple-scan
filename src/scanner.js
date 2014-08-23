var Q = require('q');
var serialPort = require("serialport");
var SerialPort = serialPort.SerialPort;

var Laser     = require("./laser");
var Camera    = require("./camera");
var TurnTable = require("./turntable");
var Vision = require("./vision");

function sleep(millis) {
  var deferredResult = Q.defer();
  setTimeout(function() {
    deferredResult.resolve();
  }, millis);
  return deferredResult.promise;
};

/////////

var Scanner =function(){
  this.serial = new SerialPort("/dev/ttyACM0", {
      baudrate: 9600,
      parser: serialPort.parsers.raw
    },false);
    
  this.laser     = new Laser(this.serial);
  this.turnTable = new TurnTable(this.serial);
  this.camera    = new Camera();
  this.vision    = new Vision();
  
  //FIXME:hack
  this.laser.sendCommand = this.sendCommand;
  this.turnTable.sendCommand = this.sendCommand;
}

Scanner.prototype={};

Scanner.prototype.onDisconnected=function*()
{
  console.log("disconnected from device");
}

Scanner.prototype.onError=function*()
{
  console.log("error in connection to device");
}

Scanner.prototype.connect=function*()
{
  var serialConnect = Q.nbind(this.serial.open, this.serial);
  var serialList    = Q.nbind(serialPort.list, serialPort);
  
  /*ports.forEach(function(port) {
    console.log(port.comName);
    console.log(port.pnpId);
    console.log(port.manufacturer);*/
  var serialPorts = yield serialList();
  try{
     yield serialConnect();
  }
  catch(error)
  {
    if(serialPorts.length>0)
    {
      console.log("connection failed, attempting on all ports");
      this.serial.path = serialPorts[0].comName;
      yield serialConnect();
    }
    //throw new Error("ye gods, run, I cannot connect!");
  }
  console.log("serial connected");
  this.serial.on("close",this.onDisconnected);
  this.serial.on("error",this.onError);
  yield sleep(500);
}

//send command to arduino, wait for ack
Scanner.prototype.sendCommand=function(command)
{
  var deferred = Q.defer();
  var callback = function(response) {
    //console.log("waiting for data", response, response.toJSON());
        if (response.toJSON()[0] == 213) {
          //console.log("oh yeah");
            // This is our frame's response. Resolve the promise.
            deferred.resolve("ok");
        } else if (response.toJSON()[0] == 211) {
              deferred.resolve("ok");
            }
  };
  this.serial.on("data", callback);
  //console.log("sending command");
  this.serial.write( new Buffer(command) );
  //console.log("waiting for response to command");
  return deferred.promise; 
}

//detect laser line
Scanner.prototype.detectLaser = function *()
{
    console.log("attempting laser detection");
    var threshold = 40;
    
    //make sure laser is off
    yield this.laser.turnOff();
    var imNoLaser = yield this.camera.read();
    //imNoLaser.save(outputFolder+'/camNoLaser'+i+'.png');*/

    //make sure laser is on
    yield this.laser.turnOn();
    var imLaser = yield this.camera.read();
    console.log("got camera image with laser");
    //imLaser.save('camLaser.png');

    //var newSize= new cv.Size(1280,96O);
    //cv::resize( laserOnFrame,laserOnFrame,cv::Size(1280,960) );
    //cv::resize( laserOffFrame,laserOffFrame,cv::Size(1280,960) );
    console.log("frames grabbed, now detecting...");
    this.vision.detectLaserLine( imNoLaser, imNoLaser, threshold );
    if(p.x == 0.0){return false;}
    this.laser.position=p;
    return true;
}

var co = require('co');

function sleep2 (ms) {
  return function (fn) {
    setTimeout(fn, ms);
  };
}
var scanner = new Scanner();
co(function* () {

  console.log("start");
  yield scanner.connect();
  yield scanner.detectLaser();



console.log("done");
})();

/*
Q.async(function*() {
    console.log("start");
    
    //yield scanner.foobar();
    var u = yield scanner.foobar();
    //u.next();
    //yield sleep(5000);
})().done();*/

module.exports = Scanner;
