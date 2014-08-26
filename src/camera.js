var Q = require('q');
var sleep = require('./sleep');
var cv = require('opencv');

var Camera = function()
{
  this.position = {x:0,y:0,z:0};
  this.rotation = {x:0,y:0,z:0};
 
  this.camera= null;
  this.flipX = false;
  this.flipY = true;
  
  this.isOn = false;
}

Camera.prototype={};

Camera.prototype.connect=function()
{
  this.camera = new cv.VideoCapture(0);
  this.isOn = true;
}

Camera.prototype.read=function*()
{
  if(!(this.isOn)) this.connect();

  var readCamera    = Q.nbind(this.camera.read, this.camera);
  yield readCamera();//empty buffer?
  var im = yield readCamera();
  if( this.flipX) im.rotate(180);
  return im;
}


module.exports = Camera;
