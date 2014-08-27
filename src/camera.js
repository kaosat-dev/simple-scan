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
  this.flipY = true;
  
  this.isOn = false;

  this.imWidth = 1280;
  this.imHeight = 960;
}


Camera.prototype={};

Camera.prototype.connect=function()
{
  this.camera = new cv.VideoCapture(0);
  this.camera.setWidth(this.imWidth);
  this.camera.setHeight(this.imHeight);
  this.isOn = true;
}

Camera.prototype.read=function*()
{
  if(!(this.isOn)) this.connect();

  var readCamera    = Q.nbind(this.camera.read, this.camera);
  yield readCamera();//empty buffer?
  var im = yield readCamera();
  if(this.flipY) im.rotate(180);
  return im;
}


module.exports = Camera;
