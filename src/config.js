//NOTE: z values are depth, x is width y is height
var config = {
  framing:{
    UPPER_ANALYZING_FRAME_LIMIT : 0,
    LOWER_ANALYZING_FRAME_LIMIT : 30,
    ORIGIN_Y: 0.75//defining the origin in the cvFrame
    //the position of intersection of back plane with ground plane in cvFrame in percent
    //check the yellow laser line to calibrate, the yellow laser line should touch the bottom plane
  },
  
  camera:{
    CAM_POS_X : 0.0,//precise by construction
    CAM_POS_Y : 5.57,
    CAM_POS_Z : 30.9,

     FRAME_WIDTH : 26.6,//in cm. the width of what the camera sees, ie place a measure tool at the back-plane and see how many cm the camera sees.
     CAM_IMAGE_WIDTH : 1280.0,
     CAM_IMAGE_HEIGHT : 960.0,
  },
  laser:{
    LASER_POS_X : 14.0,//precise by construction
    LASER_POS_Y : 6.4,//not needed/used for calculations
    LASER_POS_Z : 28.8,//precise by construction
    LASER_SWIPE_MIN : 18.0,
    LASER_SWIPE_MAX : 52.0,
    //as the actual position in the frame differs a little from calculated laserline we stop a little befor as we might catch the real non reflected laser line which creates noise
    ANALYZING_LASER_OFFSET : 90
  },
  turntable:{
    TURNTABLE_POS_X : 0.0, //not used by calculations
    TURNTABLE_POS_Y : 0.0, //not used by calculations
    TURNTABLE_POS_Z : 7.5 //precise by construction
  }
}


module.exports = config;
