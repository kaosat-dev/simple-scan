var Minilog=require("minilog");
Minilog.pipe(Minilog.suggest).pipe(Minilog.defaultFormatter).pipe(Minilog.defaultBackend); // backend - e.g. the console
Minilog.suggest.clear().deny('turntable', 'debug');
Minilog.enable();
var log = Minilog('turntable');

var TurnTable = function(serial, config)
{
  this.position   = config.turntable.position;//{x:0,y:0,z:7.5};
  this.rotation   = config.turntable.rotation;//{x:0,y:0,z:0};
  this.microSteps = config.turntable.microSteps;
  
  
  var stepsPerRot = 200; //steps per 360 deg turn
  var totalSteps = stepsPerRot*this.microSteps;//actual steps per 360 deg turn
  this.stepsPerDeg = totalSteps/360;

  this.degreesPerStep = 360.0/200.0/this.microSteps; //the size of a microstep


  this.serial = serial;
  this.isOn = false;
  this.direction = 1;
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

TurnTable.prototype.rotateByDegrees=function*(degrees)
{
  if(degrees>0 )
  {
    yield this.sendCommand([203]);
  }
  else
  {
    yield this.sendCommand([204]);
  }

  this.rotation.y -= degrees;
  var turnTableSteps = Math.abs(degrees)/this.degreesPerStep;
  turnTableSteps=Math.abs(turnTableSteps);
  log.debug("turning turntable by",degrees,"degrees",turnTableSteps,"steps");
  yield this.rotateBySteps(turnTableSteps);
}

TurnTable.prototype.rotateBySteps=function*(steps)
{
  //FIXME: number of steps cannot go lower than 1
  var size = parseInt(steps/256*2);
  var c = new Array(size);
  var s = steps;
  for(var i=0; i<=steps/256; i++)
  {
      c[2*i]=202;
      if(s<256){
          c[2*i+1]=s%256;
      }else{
          c[2*i+1]=255;
          s-=255;
      }
  }
  yield this.sendCommand(c);
  //yield this.sendCommand([202,Math.abs(steps)]);
}
module.exports = TurnTable;
