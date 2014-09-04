var express    = require('express'); 		// call express
var io = require('socket.io').listen(8082);
//var ss = require('socket.io-stream');
var app        = express(); 				// define our app using express
var port = process.env.PORT || 8080; 		// set our port
app.use(express.static("./"));




var Scanner = require("./scanner");
var scanner = new Scanner();

//////////////////////////


//serial stuff
/*var serialPort = require("serialport");
var SerialPort = serialPort.SerialPort

var serialPorts = []
//list ports
serialPort.list(function (err, ports) {
  serialPorts = ports;
  ports.forEach(function(port) {
    console.log(port.comName);
    console.log(port.pnpId);
    console.log(port.manufacturer);
  });
});

var serial = new SerialPort("/dev/ttyACM0", {
  baudrate: 9600,
  parser: serialPort.parsers.raw
},false);*/


//status
var serialConnected = false;
var laserOn  = false;
var stepperOn = false;
//////////////////////////

var clientsMap = {};

//////////////////////////
var turnTableSteps = 10;
var cameraDistance = 200;
var cameraLaserAngle = 75;
//var x = d*tan(theta);



var co = require('co');
co(function* () {
    console.log("start");
    yield scanner.connect();

//////////////////////////

io.sockets.on('connection', function (socket) {
  console.log("connected ",socket.id);
  clientsMap[socket.id] = {};
  socket.emit('userChanged',clientsMap); //send users list on connection
  socket.emit('status',{serialConnected: scanner.connected,laserOn:scanner.laser.isOn,stepperOn:scanner.turnTable.isOn,serialPorts:scanner.serialPorts});

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
  socket.on('connectToScanner', function (data) {
    console.log("SERVER recieved connect",data);
    co(function* (){
      if(!(scanner.connected))
      {
        yield scanner.connect();
      }
    })();
  });

  socket.on('toggleLaser',function(flag){
    console.log("SERVER toggling laser ",flag);
    co(function* (){
        yield scanner.laser.toggle(flag);
    })();
   });

  socket.on('toggleStepper',function(flag){
    console.log("SERVER toggling stepper ",flag);
    co(function* (){
        yield scanner.turnTable.toggle(flag);
    })();
   });

  socket.on('rotate',function (data) {
    console.log("SERVER rotating platform ",data);
    co(function* (){
        yield scanner.turnTable.rotateByDegrees(data.degrees);
    })();
  });


  socket.on('detectLaser',function(debug){
    console.log("detectLaser");
    co(function* (){
        var detected=yield scanner.detectLaser(debug);
        console.log("foooo");
        socket.emit('laserDetected',{detected:detected});
    })();
   });

   //fixme: stream image to client?
   socket.on('calibrate',function(data){
    console.log("calibrating",data);
    co(function* (){
        var calibData = yield scanner.calibrate(data.debug);
        socket.emit('calibImage',{data:calibData});
    })();
   });

   /*socket.on('scan',function(data){
    console.log("starting scan",data);
    co(function* (){
        var scanData = yield scanner.scan(parseInt(data.stepDegrees), parseInt(data.vDpi),data.debug);
        socket.emit('scanFinished',{data:scanData});
    })();
   });*/


   socket.on('scan',function(data){
    console.log("starting scan",data);
    co(function* (){
        yield scanner.scan(parseInt(data.stepDegrees), parseInt(data.vDpi),socket,data.debug);
        socket.emit('scanFinished',{data:[]});
    })();
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
  
  socket.on('disconnect', function() {
    console.log("user",clientsMap[socket.id].name,"disconnected");
  });
});

})();

app.listen(port);
console.log('Magic happens on port ' + port);
