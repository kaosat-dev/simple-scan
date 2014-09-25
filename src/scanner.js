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

Minilog.suggest.clear().deny('vision', 'error');
//Minilog.suggest.clear().deny('turntable', 'debug');
var log = Minilog('scanner');

var config = require("./config");

/////////

var Scanner =function(){
  this.connected   = false;
  this.scanning    = false;
  this.calibrating = false;
  this.autoReload  = true;
  
  this.laserDetectThreshold = 40;
  this.outputFolder         = "./scanData/";
  this.currentScan          = null;

  this.serialPorts = [];
  this.serial = new SerialPort("/dev/ttyACM0", {
      baudrate: 9600,
      parser: serialPort.parsers.raw
    },false);
    
  this.laser     = new Laser(this.serial);
  this.turnTable = new TurnTable(this.serial);
  this.camera    = new Camera(1);
  this.vision    = new Vision();
  
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

Scanner.prototype.init=function*(){
  //fetch list of serial ports
  yield this.fetchPorts();

  var readFile  = Q.denodeify(fs.readFile);
  var lastScanPath = config.lastScanPath;
  console.log("lastScanPath",lastScanPath);
  
  //var defaultFile = this.outputFolder+"pointCloud.dat";
  if(this.autoReload && lastScanPath && fs.existsSync(lastScanPath))
  {
    var lastScan = JSON.parse( yield readFile(lastScanPath) );
    this.currentScan = lastScan;
  }
  /*if(!fs.existsSync(this.outputFolder)){
    fs.mkdirSync(this.outputFolder, 0766);
  }*/
}

Scanner.prototype.fetchPorts=function*(){
  var serialList    = Q.nbind(serialPort.list, serialPort);
  var serialPorts   = this.serialPorts;
  
  try{
    this.serialPorts = serialPorts =  yield serialList();
  }catch(error)
  {
    log.error("error fetching list of available serial ports:", error);
  }
}

Scanner.prototype.connect=function*()
{
  var serialConnect = Q.nbind(this.serial.open, this.serial);
  var serialList    = Q.nbind(serialPort.list, serialPort);
  var serialPorts   = this.serialPorts;
  var serial        = this.serial;
  var self = this;
  /*ports.forEach(function(port) {
    console.log(port.comName);
    console.log(port.pnpId);
    console.log(port.manufacturer);*/
  
  try{
    this.serialPorts = serialPorts =  yield serialList();
  }catch(error)
  {
    log.error("error fetching list of available serial ports:", error);
  }
  
  function* connectAttempt()
  {
    try{
       yield serialConnect();
       self.connected = true;
       serial.on("close",self.onDisconnected);
       serial.on("error",self.onError);
       log.info("serial connected");
    }
    catch(error)
    {
      log.error("failed to connect to serial",error);
      //throw new Error("ye gods, run, I cannot connect!");
    }
    yield sleep(500);
  }
  
  var reconnectAttempts = 5;
  var autoConnect = true;
  
  for(var i=0;i<reconnectAttempts;i++)
  {
    yield connectAttempt();
    if((!this.connected) && autoConnect && serialPorts.length> 0 )
    {
      this.serial.path = serialPorts[0].comName;
      //console.log("connection failed, attempting on all ports");
    }
    else{
      break;
    }
  }

}

//send command to arduino, wait for ack
Scanner.prototype.sendCommand=function(command)
{
  var deferred = Q.defer();
  var callback = function(response) {
    //console.log("waiting for data", this, response, response.toJSON());
        var resp = response.toJSON();
        //TODO: unclear why this is different under nw
        if(resp.data) resp = resp.data;
        resp = resp[0];
        if (resp == 213) {
            this.removeListener("data",callback);
            deferred.resolve("ok");
        } else if (resp == 211) {
          deferred.resolve("ok");
          this.removeListener("data",callback);
        }
  };
  this.serial.on("data", callback);
  this.serial.write( new Buffer(command) );
  return deferred.promise; 
}

//detect laser line
Scanner.prototype.detectLaser = function *(threshold, imNoLaser, imLaser, debug)
{
    log.info("attempting laser detection");
    var threshold = threshold || this.laserDetectThreshold ;
    
    //only do this if a pre-existing image is not provided
    if(!imNoLaser)
    {
      //make sure laser is off
      yield this.laser.turnOff();
      var imNoLaser = yield this.camera.read();
      log.info("got camera image with no laser");
      if(debug) imNoLaser.save(this.outputFolder+'calib_camNoLaser.png');
    }

    if(!imLaser)
    {
      //make sure laser is on
      yield this.laser.turnOn();
      var imLaser = yield this.camera.read();
      log.info("got camera image with laser");
      if(debug) imLaser.save(this.outputFolder+'calib_camLaser.png');
    
      //imNoLaser.resize(1280,960);
      //imLaser.resize(1280,960);

      //cleanup 
      //make sure laser is off
      yield this.laser.turnOff();
    }

    log.info("frames grabbed, now detecting...");
    var p = this.vision.detectLaserLine( imNoLaser, imLaser, threshold ,debug);
    if(!(p)){return false;}
    this.laser.pointPosition = p;
    return true;
}

//do a scan ! 
/*stepDegrees: number of degrees between each scan slice
yDpi: vertical resolution
stream: flag to use streaming or not (actually a socket instance)
debug: flag 
dummy: do not actually do a scan, use pre-existing images instead
*/
Scanner.prototype.scan = function *(stepDegrees, yDpi, stream, debug, dummy)
{
  
   log.info("started scanning in ",stepDegrees,"increments, totalslices:",360/stepDegrees);
   var writeFile = Q.denodeify(fs.writeFile);
   var yDpi = yDpi || 1;
   var fullModel = {positions:[],colors:[]};
   var totalPoints =0;
   this.currentScan = fullModel;

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

   //make sure turntable is on
   this.turnTable.rotation.y = 0;
   yield this.turnTable.toggle(true);
  
    //iterate over a complete turn of the turntable
    for(i=0; i<360 && this.scanning==true; i+=stepDegrees){

        try{
        //take picture without laser
        yield this.laser.turnOff();
        var imNoLaser = yield this.camera.read();
        if(debug) imNoLaser.save(this.outputFolder+'camNoLaser'+i/stepDegrees+'.png',function(err,res){console.log(err,res);});
        //imNoLaser.resize(1280,960);

        //take picture with laser
        yield this.laser.turnOn();
        var imLaser = yield this.camera.read();
        //imLaser.resize(1280,960);
        if(debug) imLaser.save(this.outputFolder+'camLaser'+i/stepDegrees+'.png',function(err,res){console.log(err,res);});

        //if(stream) 
        model={positions:[],colors:[]};
        //here the magic happens
        this.vision.putPointsFromFrameToCloud(imNoLaser, imLaser, yDpi, 0, this.laser, this.camera, this.turnTable, model);

        if(stream){
          //stream.emit('chunkStreamed',{data:model});
          stream.emit('chunkStreamed',{data:model});
        }
          totalPoints+= model.positions.length;
          fullModel.positions = fullModel.positions.concat( model.positions);
          fullModel.colors    = fullModel.colors.concat( model.colors);

        //turn turntable x degrees
        yield this.turnTable.rotateByDegrees(stepDegrees);
        }catch(error){
          log.error("Uh-oh something went wrong");
          log.error(error);
        }
        log.info("Done slice", i/stepDegrees," out of ", 360/stepDegrees);
    }
    this.scanning = false; //stop scanning
    yield this.turnTable.toggle(false);
    yield this.laser.turnOff();

    log.info("done scanning: result model: "+totalPoints+" points");
    if(this.saveScan) yield writeFile(this.outputFolder+"pointCloud.dat",JSON.stringify(fullModel));
    return fullModel;
}

//TODO: this should actually do some things !
Scanner.prototype.calibrate = function *(doCapture, options, debug)
{
    var options = options || {};
    this.vision.lineExtractionParams = options;
    var doCapture = doCapture || (!(doCapture) && this.vision.lastLaserOn==null) && (this.vision.lastLaserOff==null);

    log.info("calibrating...capturing new frames:",doCapture, this.vision.lastLaserOn, this.vision.lastLaserOff);

    var imNoLaser = null;
    if(doCapture){
      yield this.laser.turnOff();
      imNoLaser = yield this.camera.read();
      this.vision.lastLaserOff = imNoLaser;
      log.info("captured camera image with no laser");

    
      //make sure laser is on
      yield this.laser.turnOn();
      var imLaser = yield this.camera.read();
      this.vision.lastLaserOn = imLaser;
      log.info("captured camera image with laser");

      //cleanup 
      //make sure laser is off
      yield this.laser.turnOff();
    }
    else{
      imNoLaser = this.vision.lastLaserOff;
      imLaser   = this.vision.lastLaserOn;
    }

    var linesImg = imNoLaser.copy();
    var debugImg = this.vision.extractLaserLine(imNoLaser, imLaser);
    
    
    //now do the 3d points extraction
    var laserDetected = yield this.detectLaser(null, imNoLaser, imLaser);
    var model={positions:[],colors:[]};
    var yDpi = 1;
    this.turnTable.rotation.y = 0;
    this.vision.putPointsFromFrameToCloud(imNoLaser, imLaser, yDpi, 0, this.laser, this.camera, this.turnTable, model);
    console.log("model points", model.points);
    this.currentScan = model;
    

    linesImg.resize(320,240);
    debugImg.resize(320,240);
    this.vision.drawHelperLines( linesImg );

    var buffNoLaser = linesImg.toBuffer();
    var buffDebuger = debugImg.toBuffer();

    log.info("calibration processing done, returning data");
    return {lines:buffNoLaser, debug:buffDebuger, pointCloudData:model};
}

Scanner.prototype.saveScan = function *(fileName, options)
{
  if(!this.currentScan) return;
  var writeFile = Q.denodeify(fs.writeFile);
  //yield writeFile(this.outputFolder+"pointCloud.dat",JSON.stringify(this.currentScan));
  
  //save as ply TODO: this is a prototype, move this to serializer + writer
  //var fileName = "pointCloud.ply";
  var format = "ascii"; //can be ascii, binary big & little endian http://en.wikipedia.org/wiki/PLY_(file_format)
  var formatVersion = "1.0";
  var pointsCount = 0;
  
  pointsCount = this.currentScan.positions.length;
  /*var stream = fs.createWriteStream(this.outputFolder+fileName);
  stream.once('open', function(fd) {
    stream.write("My first row\n");
    stream.write("My second row\n");
    stream.end();
  });*/
  var output = [];
  output.push("ply");
  output.push(format+" " + formatVersion);
  output.push("element vertex " + pointsCount);
  output.push("property float x");
  output.push("property float y");
  output.push("property float z");
  
  output.push("property float diffuse_red");
  output.push("property float diffuse_green");
  output.push("property float diffuse_blue");
  
  output.push("end_header");
  
  var pos = this.currentScan.positions;
  var cols = this.currentScan.colors;
  
  for(var i=0;i<pointsCount;i+=3)
  {
    output.push(pos[i]+" "+pos[i+1]+" "+pos[i+2]+" "+ cols[i]+" "+cols[i+1]+" "+cols[i+2]);
  }
  output = output.join("\n");
  yield writeFile(fileName,output);
}

Scanner.prototype.loadScan = function *(fileName, options){
  var readFile  = Q.denodeify(fs.readFile);
  var extName = path.extname(fileName);
  
  switch(extName)
  {
    case 'dat':
      var lastScan = JSON.parse( yield readFile(fileName) );
    break;
    case 'ply':
      console.log("NOT IMPLEMENTED");
    break;
    default:
      throw Error("file has no extension, cannot load");
    break;
  
  }
  
  
  this.currentScan = lastScan ;
}

Scanner.prototype.saveSettings = function *(options)
{
  var writeFile = Q.denodeify(fs.writeFile);
  //TODO: how to
  //this.outputFolder+"pointCloud.dat"
  //yield writeFile("./config.json");//,JSON.stringify(this.latestScan));
}




module.exports = Scanner;
