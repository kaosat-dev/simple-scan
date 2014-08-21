
var io = require('socket.io').listen(8082);
var cv = require('opencv');

/*handle camera stuff*/
/*
var camera = new cv.VideoCapture(0);

setInterval(function() {

	camera.read(function(err, im) {
        im.rotate(180);
		im.save('cam.png');
        
	});

}, 500);*/

//////////////////////////
//serial stuff
var serialport = require("serialport");
var SerialPort = serialport.SerialPort

var serial = new SerialPort("/dev/ttyACM1", {
  baudrate: 9600,
  parser: serialport.parsers.raw
});

//////////////////////////

var clientsMap = {};


io.sockets.on('connection', function (socket) {
  console.log("connected ",socket.id);

  clientsMap[socket.id] = {};
  socket.emit('userChanged',clientsMap); //send users list on connection

  socket.on('message', function (data) {
    console.log("SERVER recieved message",data);
    data.senderId = socket.id;
    console.log("Server sending out", data);
    socket.broadcast.emit('message',data);
  });

  socket.on('userChanged', function (data) {
    console.log("SERVER recieved userChanged",data);
    clientsMap[socket.id].name = data.user.name;
    clientsMap[socket.id].color = data.user.color;
    socket.broadcast.emit('userChanged',clientsMap);
  });

  ///////////////////////////////////

  //video frame recieved
  socket.on('frame',function (data) {
    data = data.split(',')[1];
    //data = data?.split(',')?[1];
    cv.readImage(new Buffer(data, 'base64'), function(err, im) {
        console.log('errOpenCV ' + err);
        /*im.detectObject("./node_modules/opencv/data/haarcascade_eye.xml", {}, function(err, ojos) {


        });*/

        im.detectObject("./node_modules/opencv/data/haarcascade_frontalface_alt.xml", {}, function(err, faces){  
 
					for (var i=0;i<faces.length; i++){
						var x = faces[i];
						im.ellipse(x.x + x.width/2, x.y + x.height/2, x.width/2, x.height/2);
					}

					im.save('./out.png');   
		});


    });
  });

  socket.on('toggleLaser',function (data) {
    console.log("SERVER toggling laser ",data);

    if(data)
    {
         serial.write(new Buffer([201]), function(err, results) {
            console.log('err3 ' + err);
            console.log('sent ' + results);
          });
    }
    else
    {
        serial.write(new Buffer([200]), function(err, results) {
            console.log('err3 ' + err);
            console.log('sent ' + results);
          });
    }

  });

socket.on('toggleStepper',function (data) {
    console.log("SERVER toggling stepper ",data);

    if(data)
    {
         serial.write(new Buffer([205]), function(err, results) {
            console.log('err3 ' + err);
            console.log('sent ' + results);
          });
    }
    else
    {
        serial.write(new Buffer([206]), function(err, results) {
            console.log('err3 ' + err);
            console.log('sent ' + results);
          });
    }

  });


  socket.on('rotate',function (data) {
    console.log("SERVER rotating platform ",data);
    var dir = data.direction;
    if(dir == "CW")
    {
        serial.write(new Buffer([203]), function(err, results) {
            console.log('err3 ' + err);
            console.log('sent ' + results);
          });
        serial.write(new Buffer([202]), function(err, results) {
            console.log('err3 ' + err);
            console.log('sent ' + results);
          });
    }else{
        serial.write(new Buffer([204]), function(err, results) {
            console.log('err3 ' + err);
            console.log('sent ' + results);
          });
        serial.write(new Buffer([202]), function(err, results) {
            console.log('err3 ' + err);
            console.log('sent ' + results);
          });
    }
  });


  socket.on('detectLaser',function(){
    console.log("detectLaser");
    /* 
        - turn off laser
        - grab and store frame 
        - turn on laser
        - grab and store frame 

    */
    var threshold = 40;
    //original cpp code
    /*unsigned int threshold = 40;
    laser->turnOff();
    QThread::msleep(200);
    cv::Mat laserOffFrame = webcam->getFrame();
    laser->turnOn();
    QThread::msleep(200);
    cv::Mat laserOnFrame = webcam->getFrame();
    cv::resize( laserOnFrame,laserOnFrame,cv::Size(1280,960) );
    cv::resize( laserOffFrame,laserOffFrame,cv::Size(1280,960) );

    qDebug("images loaded, now detecting...");
    FSPoint p = vision->detectLaserLine( laserOffFrame, laserOnFrame, threshold );
    if(p.x == 0.0){return false;}
    laser->setLaserPointPosition(p);
    return true;*/


    });
  
  socket.on('disconnect', function() {
    console.log("user",clientsMap[socket.id].name,"disconnected");
  });

});

//////////////////////////
//fabscan stuff
/*#define TURN_LASER_OFF      200
#define TURN_LASER_ON       201
#define PERFORM_STEP        202
#define SET_DIRECTION_CW    203
#define SET_DIRECTION_CCW   204
#define TURN_STEPPER_ON     205
#define TURN_STEPPER_OFF    206
#define TURN_LIGHT_ON       207
#define TURN_LIGHT_OFF      208
#define ROTATE_LASER        209
#define FABSCAN_PING        210
#define FABSCAN_PONG        211
#define SELECT_STEPPER      212
#define LASER_STEPPER       11
#define TURNTABLE_STEPPER   10*/




serial.on("open", function () {
  console.log('serial open');


  serial.on('data', function(data) {
    console.log(data);
    //var encoded = new Buffer(data, 'binary').toString('utf8');
    //console.log(encoded);
  });

  /*serial.write(211, function(err, results) {
    console.log('err ' + err);
    console.log('results ' + results);
  });*/

});

