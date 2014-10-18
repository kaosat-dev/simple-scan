var Q = require('q');
var sleep = require('./sleep');

var Laser = function(serial, config)
{
  //NOTE: taken from infos in fsconfiguration.cpp from original fabscan
  this.position = config.laser.position;//{x:config.laser.position.x 14.0,y:6.4,z:28.8};
  this.rotation = config.laser.rotation;//{x:0,y:0,z:0};
  this.pointPosition = config.laser.pointPosition;//{x:14.0, y:0.0,z: 0.0};
  this.analyzingOffset = config.laser.analyzingOffset;
  this.togglingDelay   = config.laser.togglingDelay;//how much time until laser is actually switched on/off

  this.serial = serial;
  this.isOn = false;
}

Laser.prototype={};

Laser.prototype.setLaserPointPosition=function(pos)
{
    var b = this.position.x - pos.x;
    var a = this.position.z - pos.z;
    this.rotation.y = Math.atan(b/a)*180.0/Math.PI;
    console.log("Current laser angle: ",this.rotation.y);
}

Laser.prototype.toggle=function*(flag)
{
  var isOn = this.isOn;
  if(flag == undefined)
  {
    isOn != isOn;
  }
  else
  {
    isOn = flag;
  }

  if(!isOn)
  {
    yield this.sendCommand([200]);
  }
  else
  {
    yield this.sendCommand([201]);
  }
  
  this.isOn= isOn;
  yield sleep(this.togglingDelay);
}

Laser.prototype.turnOff=function*()
{
   yield this.sendCommand([200]);
   yield sleep(this.togglingDelay);
   this.isOn = false;
}

Laser.prototype.turnOn=function*()
{
   yield this.sendCommand([201]);
   yield sleep(this.togglingDelay);
   this.isOn = true;
}

module.exports = Laser;
