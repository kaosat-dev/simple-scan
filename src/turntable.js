var TurnTable = function(serial)
{
  this.position = {x:0,y:0,z:0};
  this.rotation = {x:0,y:0,z:0};
 
  this.serial = serial;

  var stepsPerRot = 400; //steps per 360 deg turn
  var microSteps = 16;
  var totalSteps = 6400;//actual steps per 360 deg turn
  this.stepsPerDeg = totalSteps/360;
  this.isOn = false;
}

TurnTable.prototype={};


TurnTable.prototype.toggle=function*(flag)
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
    yield this.sendCommand([206]);
  }
  else
  {
    yield this.sendCommand([205]);
  }

  this.isOn= isOn;
}

TurnTable.prototype.rotateByAngle=function*(angle)
{
  if(angle>0)
  {
    yield this.sendCommand([203]);
  }
  else
  {
    yield this.sendCommand([204]);
  }

  //FIXME: param is in steps, not angle
  var turnTableSteps = angle*this.stepsPerDeg;
  yield this.sendCommand([202,turnTableSteps]);
}

TurnTable.prototype.rotateBySteps=function*(steps)
{
  console.log("rotating turntable by", steps);
  if(steps>0)
  {
    yield this.sendCommand([203]);
  }
  else
  {
    yield this.sendCommand([204]);
  }

  yield this.sendCommand([202,Math.abs(steps)]);
}
module.exports = TurnTable;
