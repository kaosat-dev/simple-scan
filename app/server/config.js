//NOTE: z values are depth, x is width y is height
var config = {
  lastScanPath: "",
  
  framing:{
    upperLimit:0,
    lowerLimit:30,
    originY:0.75//defining the origin in the cvFrame
    //the position of intersection of back plane with ground plane in cvFrame in percent
    //check the yellow laser line to calibrate, the yellow laser line should touch the bottom plane
  },
  
  camera:{
    position : {
      x:0,//precise by construction
      y:5.57,
      z:30.9},
     
     //in cm. the width of what the camera sees, ie place a measure tool at the back-plane and see how many cm the camera sees.
     frameWidth : 26.6,
     imWidth : 1280.0,
     imHeight : 960.0
  },
  laser:{
    position: {
      x:14.0,//precise by construction
      y:6.4,//not needed/used for calculations
      z:28.8//precise by construction
    },
    swipeRange:{
      min:18.0,
      max:52.0
    },
    //as the actual position in the frame differs a little from calculated laserline 
    //we stop a little befor as we might catch the real non reflected laser line which creates noise
    analyzingOffset:90
  },
  turntable:{
    position : {
      x:0,//not used by calculations
      y:0,//not used by calculations
      z:7.5//precise by construction
      }
  }
}


module.exports = config;
