var Q = require('q');
var sleep = require('./sleep');
var cv = require('opencv');

var Camera = function()
{
  //TODO: get these from config/make them settable
  this.position = {x:0,y:5.57,z:30.9};
  this.rotation = {x:0,y:0,z:0};
 
  this.camera= null;
  this.flipX = false;
  this.flipY = false;
  
  this.isOn = false;

  this.imWidth = 1280;
  this.imHeight = 960;

  //FIXME : workaround for mem leak
  this._capturedFrames = 0;
}


Camera.prototype={};

Camera.prototype.connect=function()
{
  console.log("this.imWidth",this.imWidth,"this.imHeight",this.imHeight);
  this.camera = new cv.VideoCapture(0);
  this.camera.setWidth(this.imWidth);
  this.camera.setHeight(this.imHeight);
  this.isOn = true;
  //this.readCamera    = Q.nbind(this.camera.read, this.camera);
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
  
  var flushAmount = 25;
  for(var i=0;i<flushAmount;i++)
  {
    //yield this.readCamera();//empty buffer?
    this._read();
    yield sleep(0);
  }
  var im = this._read();//yield this.readCamera();
  if(this.flipY) im.rotate(180);
  if(this.flipX) im.rotate(-180);

  return im;
}


module.exports = Camera;
