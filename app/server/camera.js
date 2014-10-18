var Q = require('q');
var sleep = require('./sleep');
var cv = require('opencv');

var Camera = function(videoDeviceIndex, config)
{
  this.position = config.camera.position;
  this.rotation = config.camera.rotation;
  
  this.imWidth  = config.camera.imWidth;
  this.imHeight = config.camera.imHeight;
  
  this.flipX = config.camera.flipX;
  this.flipY = config.camera.flipY;
  
  this.frameWidth    = config.camera.frameWidth;
  this.framesToFlush = config.camera.framesToFlush;//workaround for camera buffers not emptying
  
  
  this.isOn = false;
  this.camera= null;
  this.videoDeviceIndex = videoDeviceIndex || 0;
 

  //FIXME : workaround for opencv videocapture mem leak
  this._capturedFrames  = 0;

 
}


Camera.prototype={};

Camera.prototype.connect=function()
{
  this.camera = new cv.VideoCapture(this.videoDeviceIndex);
  this.camera.setWidth(this.imWidth);
  this.camera.setHeight(this.imHeight);
  this.isOn = true;
}


Camera.prototype.readTest = function()
{
  this.camera.ReadSync();//(function(err,res){});
  global.gc();
}

Camera.prototype._read = function()
{
  this._capturedFrames +=1 ;
  if(this._capturedFrames >= 5){
    global.gc();
    this._capturedFrames = 0;
  }
  return this.camera.ReadSync();
}

Camera.prototype.read=function*()
{
  if(!(this.isOn)) this.connect();
  
  for(var i=0;i<this.framesToFlush;i++)
  {
    //yield this.readCamera();//empty buffer?
    this._read();
    yield sleep(0);
  }
  var im = this._read();//yield this.readCamera();
  if(this.flipY) im.rotate(180);
  if(this.flipX) im.rotate(-180);
  
  //FIXME: force image size to intended resolution
  var width = im.width();//laserLine.height();
  var height = im.height();//laserLine.width();
  if( width != this.imWidth || height != this.imHeight)
  {
    im.resize(this.imWidth,this.imHeight);
  }

  return im;
}


module.exports = Camera;
