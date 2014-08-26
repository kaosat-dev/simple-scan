var Q = require('q');
var serialPort = require("serialport");
var SerialPort = serialPort.SerialPort;
var sleep      = require('./sleep');

var Laser     = require("./laser");
var Camera    = require("./camera");
var TurnTable = require("./turntable");
var Vision    = require("./vision");

/////////

var Scanner =function(){
  this.connected = false;
  this.outputFolder = "./scanData/";
  this.scanning = false;

  this.serialPorts = [];
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
  var serialPorts = this.serialPorts =  yield serialList();
  try{
     yield serialConnect();
     this.connected = true;
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
            deferred.resolve("ok");
        } else if (response.toJSON()[0] == 211) {
              deferred.resolve("ok");
            }
  };
  this.serial.on("data", callback);
  this.serial.write( new Buffer(command) );
  return deferred.promise; 
}

//detect laser line
Scanner.prototype.detectLaser = function *(debug)
{
    console.log("attempting laser detection");
    var threshold = 40;
    
    //make sure laser is off
    yield this.laser.turnOff();
    var imNoLaser = yield this.camera.read();
    if(debug) imNoLaser.save(this.outputFolder+'calib_camNoLaser.png');

    //make sure laser is on
    yield this.laser.turnOn();
    var imLaser = yield this.camera.read();
    console.log("got camera image with laser");
    if(debug) imLaser.save(this.outputFolder+'calib_camLaser.png');

    //var newSize= new cv.Size(1280,96O);
    //cv::resize( laserOnFrame,laserOnFrame,cv::Size(1280,960) );
    //cv::resize( laserOffFrame,laserOffFrame,cv::Size(1280,960) );

    //cleanup 
    //make sure laser is off
    yield this.laser.turnOff();

    console.log("frames grabbed, now detecting...");
    var p = yield this.vision.detectLines( imLaser, imNoLaser, threshold );
    console.log("got result", p);
    if(!(p)){return false;}
    this.laser.position = p;
    return true;
}

//do a scan ! 
Scanner.prototype.scan = function *(stepDegrees ,debug)
{
   var yDpi = 10;
   //detect laser line
   yield this.detectLaser();
   //make sure laser is off
   yield this.laser.turnOff();

   this.scanning = true; //start scanning, if false, scan stops
   var stepDegrees = stepDegrees;//turntableStepSize;

   //make sure laser is on
   //yield this.laser.turnOn();
   //and turntable too
   yield this.turnTable.toggle(true);

    //iterate over a complete turn of the turntable
    for(i=0; i<360 && this.scanning==true; i+=stepDegrees){

        //take picture without laser
        yield this.laser.turnOff();
        var imNoLaser = yield this.camera.read();
        if(debug) imNoLaser.save(this.outputFolder+'camNoLaser'+i/stepDegrees+'.png');
        //cv::resize( laserOff,laserOff,cv::Size(1280,960) );

        yield sleep(150);
        //take picture with laser
        yield this.laser.turnOn();
        var imLaser = yield this.camera.read();
        //cv::resize( laserOn,laserOn,cv::Size(1280,960) );
        if(debug) imLaser.save(this.outputFolder+'camLaser'+i/stepDegrees+'.png');

        
        //here the magic happens
        this.vision.putPointsFromFrameToCloud(imNoLaser, imLaser, yDpi, 0);

        //TODO: stream data to browser
        //geometries->setPointCloudTo(model->pointCloud);

        //turn turntable a step
        yield this.turnTable.rotateByAngle(stepDegrees);
    }
    this.scanning = false; //stop scanning
    yield this.turnTable.toggle(false);
}


module.exports = Scanner;
