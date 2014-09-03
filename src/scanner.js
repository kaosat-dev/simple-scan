var Q = require('q');
var Minilog=require("minilog");
var fs = require('fs');
var serialPort = require("serialport");
var SerialPort = serialPort.SerialPort;
var sleep      = require('./sleep');

var Laser     = require("./laser");
var Camera    = require("./camera");
var TurnTable = require("./turntable");
var Vision    = require("./vision");


Minilog.pipe(Minilog.suggest) // filter
       .pipe(Minilog.defaultFormatter) // formatter
       .pipe(Minilog.defaultBackend); // backend - e.g. the console
Minilog
  .suggest
    .clear()
    .deny('vision', 'info');
Minilog.enable();
var log = Minilog('vision');

var config = require("./config");

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
    log.info("attempting laser detection");
    var threshold = 40;
    
    //make sure laser is off
    yield this.laser.turnOff();
    var imNoLaser = yield this.camera.read();
    log.info("got camera image with no laser");
    if(debug) imNoLaser.save(this.outputFolder+'calib_camNoLaser.png');

    
    //make sure laser is on
    yield this.laser.turnOn();
    yield sleep(300);
    var imLaser = yield this.camera.read();
    log.info("got camera image with laser");
    if(debug) imLaser.save(this.outputFolder+'calib_camLaser.png');

    //imNoLaser.resize(1280,960);
    //imLaser.resize(1280,960);

    //cleanup 
    //make sure laser is off
    yield this.laser.turnOff();

    log.info("frames grabbed, now detecting...");
    var p = this.vision.detectLaserLine( imNoLaser, imLaser, threshold ,debug);
    console.log("got result", p);
    if(!(p)){return false;}
    this.laser.pointPosition = p;
    return true;
}

//do a scan ! 
/*stepDegrees: number of degrees between each scan slice
debug: flag 
dummy: do not actually do a scan, use pre-existing images instead
*/
Scanner.prototype.scan = function *(stepDegrees ,debug, dummy)
{
   log.info("started scanning in ",stepDegrees,"increments, totalslices:",360/stepDegrees);
   var writeFile = Q.denodeify(fs.writeFile);
   var yDpi = 2;
   var model = [];//FIXME:stand in for now

   //detect laser line
   var laserDetected = yield this.detectLaser();
   while(laserDetected == false)
   {
      laserDetected = yield this.detectLaser();
   }
   
   //make sure laser is off
   yield this.laser.turnOff();

   this.scanning = true; //start scanning, if false, scan stops
   var stepDegrees = stepDegrees;//turntableStepSize;

   //make sure laser is on
   //yield this.laser.turnOn();
   //and turntable too
   this.turnTable.rotation.y = 0;
   yield this.turnTable.toggle(true);

    //iterate over a complete turn of the turntable
    for(i=0; i<360 && this.scanning==true; i+=stepDegrees){

        //take picture without laser
        yield this.laser.turnOff();
        var imNoLaser = yield this.camera.read();
        if(debug) imNoLaser.save(this.outputFolder+'camNoLaser'+i/stepDegrees+'.png');
        //imNoLaser.resize(1280,960);

        yield sleep(150);
        //take picture with laser
        yield this.laser.turnOn();
        var imLaser = yield this.camera.read();
        //imLaser.resize(1280,960);
        if(debug) imLaser.save(this.outputFolder+'camLaser'+i/stepDegrees+'.png');

        //here the magic happens
        this.vision.putPointsFromFrameToCloud(imNoLaser, imLaser, yDpi, 0, this.laser, this.camera, this.turnTable, model);

        //TODO: stream data to browser
        //geometries->setPointCloudTo(model->pointCloud);
        console.log("foo",i);

        //turn turntable a step
        yield this.turnTable.rotateByDegrees(stepDegrees);
    }
    this.scanning = false; //stop scanning
    yield this.turnTable.toggle(false);

    log.info("done scanning: result model: "+model.length+" points");
    yield writeFile(this.outputFolder+"pointCloud.dat",JSON.stringify(model));
    return model;
}

//TODO: this should actually do some things !
Scanner.prototype.calibrate = function *(debug)
{
    var img = yield this.camera.read();
    img.resize(320,240);
    this.vision.drawHelperLines( img );


    var buff = img.toBuffer()
    return buff;
}


module.exports = Scanner;
