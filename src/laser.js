var Laser = function(serial)
{
  //NOTE: taken from infos in fsconfiguration.cpp from original fabscan
  this.position = {x:14.0,y:6.4,z:28.8};
  this.rotation = {x:0,y:0,z:0};
 
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

Laser.prototype.toggle=function*()
{
  var isOn = this.isOn;
  if(isOn)
  {
    yield this.sendCommand([200]);
  }
  else
  {
    yield this.sendCommand([201]);
  }
  
  yield sleep(200);
  isOn != isOn;
}

Laser.prototype.turnOff=function*()
{
   yield this.sendCommand([200]);
   this.isOn = false;
}

Laser.prototype.turnOn=function*()
{
   yield this.sendCommand([201]);
   this.isOn = true;
}

module.exports = Laser;
