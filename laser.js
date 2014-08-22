var Laser = function()
{
  //NOTE: taken from infos in fsconfiguration.cpp from original fabscan
  this.position = {x:14.0,y:6.4,z:28.8};
  this.rotation = {x:0,y:0,z:0};

 /*LASER_POS_X = 14.0f; //precise by construction
 LASER_POS_Y = 6.4f;  //not needed/used for calculations
 LASER_POS_Z = 28.8f; //precise by construction*/
}

Laser.prototype={};

Laser.prototype.setLaserPointPosition=function(pos)
{
    var b = this.position.x - pos.x;
    var a = this.position.z - pos.z;
    rotation.y = Math.atan(b/a)*180.0/Math.PI;
    console.log("Current laser angle: ",rotation.y);
    //FSController::getInstance()->controlPanel->setLaserAngleText(rotation.y);
}

module.exports = Laser;
