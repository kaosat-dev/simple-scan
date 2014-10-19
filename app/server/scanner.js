var Q = require('q');
var Minilog=require("minilog");
var fs = require('fs');
var path = require('path');
var pathExtra  = require('path-extra');
var serialPort = require("serialport");
var SerialPort = serialPort.SerialPort;
var sleep      = require('./sleep');
var yaml       = require('js-yaml');

var appName = require('../../package.json').name;
//if there is no custom config file, create one from defaults
var configPath = path.join( pathExtra.datadir(appName),"config.yml");
if(!fs.existsSync(configPath))
{
  fs.writeFileSync(configPath, fs.readFileSync('./server/config.default.yml'));
}

var Laser     = require("./laser");
var Camera    = require("./camera");
var TurnTable = require("./turntable");
var Vision    = require("./vision");

var log = Minilog('scanner');

Minilog.suggest.clear().deny('camera', 'error')
.deny('laser', 'error')
.deny('vision', 'error')
.deny('turntable', 'error')
.deny('scanner', 'error');
Minilog.enable();

var config = yaml.safeLoad(fs.readFileSync(configPath, 'utf8'));
/////////

var Scanner =function(){
  this.connected   = false;
  this.scanning    = false;
  this.calibrating = false;
  this.loadingData = false;
  this.autoReload  = true;
  this.reconnectAttempts = 5;
  this.autoConnect       = true;
  
  this.lastScanPath = "";
  
  this.laserDetectThreshold = 40;
  this.outputFolder         = "./scanData/";
  this.currentScan          = null;
  this.scanTime             =0;
  this._scanStart= null;
  this.scanProgress =0;
  
  this.updateAvailable = false;

  this.serialPorts = [];
  this.serial = new SerialPort("/dev/ttyACM0", {
      baudrate: 9600,
      parser: serialPort.parsers.raw,
      disconnectedCallback: this.onDisconnected
    },false);
  this.serialPoller = null;
  
    
  this.laser     = new Laser( this.serial    ,config );
  this.turnTable = new TurnTable( this.serial, config );
  this.camera    = new Camera( 1, config );
  this.vision    = new Vision( config );
  
  this.laser.sendCommand = this.sendCommand;
  this.turnTable.sendCommand = this.sendCommand;
  
}

Scanner.prototype={};

Scanner.prototype.onDisconnected=function()
{
  log.error("disconnected from device");
}

Scanner.prototype.onError=function()
{
  log.error("error in connection to device");
}

Scanner.prototype.init=function*(){
  var lastScanPath = this.lastScanPath = config.lastScanPath;
  this.autoReload = config.autoReload;
  this.autoConnect= config.autoConnect;

  //fetch list of serial ports
  yield this.fetchPorts();

  var readFile  = Q.denodeify(fs.readFile);
  
  //var defaultFile = this.outputFolder+"pointCloud.dat";
  if(this.autoReload && lastScanPath && fs.existsSync(lastScanPath))
  {
    var lastScan = yield this.loadScan( lastScanPath );
    this.currentScan = lastScan;
  }
  if(this.autoConnect)
  {
    this.pollPorts();
  }
}

Scanner.prototype.fetchPorts=function*(){
  var serialList    = Q.nbind(serialPort.list, serialPort);
  var serialPorts   = this.serialPorts;
  
  try{
    var serialPorts =  yield serialList();
    
    if(serialPorts.length!=this.serialPorts.length)
    {
      this.serialPorts = serialPorts;
      return;
    }
    for(var i=0;i<serialPorts.length;i++)
    {
      if(serialPorts[i].comName != this.serialPorts[i].comName)
      {
        this.serialPorts = serialPorts;
        break;
      }
    }
    //if(this.serialPorts != serialPorts) this.serialPorts = serialPorts;
  }catch(error)
  {
    log.info("error fetching list of available serial ports:", error);
    if(this.serialPorts.length!==0)
    {
      this.serialPorts = [];
    }
  }
}

Scanner.prototype.pollPorts=function(){
  var self = this;
  var poller = function*() { 
      yield self.fetchPorts();
      //console.log("POLLING",self.autoConnect,self.connected,self.serialPorts);
      if(self.connected  && self.serialPorts.length==0)
      {
        //TODO add support for multiple ports
        self.onDisconnected("port disconnect");
        self.connected= false;
      }
      if(self.autoConnect && !self.connected && self.serialPorts.length>0)
      {
        yield self.connect();
      }
    }
  var co = require('co');
  poller = co(poller);
  this.serialPoller = setInterval(poller, 2000);
}

Scanner.prototype.uploadFirmware = function*(){
  log.error("uploading firmware");
  var hexToBin = function(code) {
    var count, data, line, _i, _len, _ref;
    data = '';
    _ref = code.split('\n');
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      line = _ref[_i];
      count = parseInt(line.slice(1, 3), 16);
      if (count && line.slice(7, 9) === '00') {
        data += line.slice(9, 9 + 2 * count);
      }
    }
    return new Buffer(data, 'hex');
  };
  //this.disconnect();
  
  var avrUploader = require("./avrUpload_");
  
  var hex = fs.readFileSync('./firmware/firmware.hex', 'ascii');
  var toUpload = hexToBin(hex);
  
  //hack 
  this.serial.baudRate = 115200;
  
  avrUploader(this.serial, toUpload, '/dev/ttyACM0', function(err) {
    if (err) {
      console.error('err', err);
    }
    console.log(toUpload.length);
  });
  yield sleep(5000);
  
  yield this.connect();
}

Scanner.prototype.connect=function*()
{
  var serialConnect = Q.nbind(this.serial.open, this.serial);
  var serialList    = Q.nbind(serialPort.list, serialPort);
  var serialPorts   = this.serialPorts;
  var serial        = this.serial;
  var self = this;
  
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
       serial.on("disconnected",self.onDisconnected);
       serial.on("close",self.onDisconnected);
       serial.on("error",self.onError);
       
       log.info("serial connected to port",serial.path);
    }
    catch(error)
    {
      log.error("failed to connect to serial",error);
      //throw new Error("ye gods, run, I cannot connect!");
    }
    yield sleep(500);
  }
  
  var reconnectAttempts = self.reconnectAttempts;
  var autoConnect       = self.autoConnect;

  for(var i=0;i<reconnectAttempts;i++)
  {
    try{
      yield connectAttempt();
    }catch(error){}
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


Scanner.prototype.disconnect = function()
{
  if(this.connected){
  
  try{
    this.serial.close();} catch(error){}
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
   var scanStepsTotal = 360/stepDegrees;
   var scanStep = 1/scanStepsTotal*100;
   console.log("scanning");
   
   log.info("started scanning in ",stepDegrees,"increments, totalslices:",scanStepsTotal);
   var writeFile = Q.denodeify(fs.writeFile);
   var yDpi = yDpi || 1;
   var fullModel = {positions:[],colors:[]};
   var totalPoints =0;
   this.currentScan = fullModel;
   this._scanStart = new Date().getTime();
   this.scanTime = 0;
   this.scanProgress = 0;

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
        log.info("Done slice", i/stepDegrees," out of ", scanStepsTotal);
        this.scanProgress += scanStep;
    }
    
    this.scanning = false; //stopped scanning
    yield this.turnTable.toggle(false);
    yield this.laser.turnOff();
    
    var scanEnd = new Date().getTime();
    var scanTime = (Math.round(scanEnd-this._scanStart) / 1000);
    this.scanTime = scanTime;

    log.info("done scanning: result model: "+totalPoints+" points");
    //if(this.saveScan) yield this.saveScan("_lastScan.ply");
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

    var linesImg = imLaser.copy();
    var debugImg = this.vision.extractLaserLine(imNoLaser, imLaser);
    
    
    //now do the 3d points extraction
    var laserDetected = yield this.detectLaser(null, imNoLaser, imLaser);
    var model={positions:[],colors:[]};
    var yDpi = 1;
    this.turnTable.rotation.y = 0;
    this.vision.putPointsFromFrameToCloud(imNoLaser, imLaser, yDpi, 0, this.laser, this.camera, this.turnTable, model);
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
  
  this.lastScanPath = fileName;
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
  output.push("format "+format+" " + formatVersion);
  output.push("element vertex " + pointsCount);
  output.push("property float x");
  output.push("property float y");
  output.push("property float z");
  
  output.push("property float red");
  output.push("property float green");
  output.push("property float blue");
  
  output.push("end_header");
  
  var pos = this.currentScan.positions;
  var cols = this.currentScan.colors;
  
  for(var i=0;i<pointsCount;i+=3)
  {
    output.push(pos[i]+" "+pos[i+1]+" "+pos[i+2]+" "+ cols[i]+" "+cols[i+1]+" "+cols[i+2]);
  }
  output = output.join("\n");
  yield writeFile(fileName,output);
  
  yield this.saveSettings();
}

Scanner.prototype.loadScan = function *(fileName, options){

  var readFile  = Q.denodeify(fs.readFile);
  var extName = path.extname(fileName);
  this.lastScanPath = fileName;
  this.loadingData = true;
  switch(extName)
  {
    case '.dat':
      var lastScan = JSON.parse( yield readFile(fileName) );
    break;
    case '.ply':
      var PLYParser = require("usco-ply-parser");
      var plyParser = new PLYParser();
      var lastScan = yield( plyParser.parse( yield readFile(fileName), {useWorker:false,rawBuffers:true} ).promise );
    break;
    default:
      throw Error("file has no extension, cannot load");
    break;
  }
  
  this.loadingData = false;  
  this.currentScan = lastScan ;
  
  yield this.saveSettings();
}

Scanner.prototype.saveSettings = function *(options)
{
  var writeFile = Q.denodeify(fs.writeFile);
  var readFile  = Q.denodeify(fs.readFile);

  config.lastScanPath = this.lastScanPath;
  
  config.vision.upperLimit = this.vision.upperFrameLimit;
  config.vision.lowerLimit = this.vision.lowerFrameLimit;
  config.vision.originY    = parseFloat(this.vision.origin.y);
  config.vision.lineExtractionParams = this.vision.lineExtractionParams;
  
  config.camera.position       = this.camera.position;
  config.camera.frameWidth     = this.camera.frameWidth;
  config.camera.framesToFlush  = this.camera.framesToFlush;
  config.camera.flipY          = this.camera.flipY;
  config.camera.flipX          = this.camera.flipX;
  
  config.laser.position        = this.laser.position;
  config.laser.pointPosition   = this.laser.pointPosition;
  config.laser.rotation        = this.laser.rotation;
  config.laser.analyzingOffset = this.laser.analyzingOffset;
  
  config.turntable.position    = this.turnTable.position;
  config.turntable.rotation    = this.turnTable.rotation;
  
  log.info("saving configuration");
  var out = yaml.safeDump( config );
  fs.writeFileSync(configPath, out);
}

Scanner.prototype.checkForUpdates = function *(options)
{
  log.info("checking for updates");
  var remoteCheckUrl = 'https://raw.githubusercontent.com/kaosat-dev/simple-scan/master/package.json';
  var localVersion = require('../../package.json').version;
  
  
  function fetchRemoteVersion(){
    var deferred = Q.defer();
    var http = require('https');

    var request = http.get(remoteCheckUrl, function (res) {
        var data = '';
        res.on('data', function (chunk) {
            data += chunk;
        });
        res.on('end', function () {
            data = JSON.parse(data).version;
            deferred.resolve(data);

        });
    });
    request.on('error', function (e) {
        deferred.reject(e);
    });
    request.end();
    return deferred.promise;
  }
  
  
  var remoteVersion = yield fetchRemoteVersion(); 
  
  var semver  = require('semver');
  if(semver.gt(remoteVersion, localVersion))
  {
    this.updateAvailable = true;
    log.info("new version available");
  }
}
module.exports = Scanner;
