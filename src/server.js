var express    = require('express'); 		// call express
var io         = require('socket.io');
var app        = express(); 				// define our app using express
var port = process.env.PORT || 8080; 		// set our port
app.use(express.static("./"));


var sleep      = require('./sleep');
var Scanner = require("./scanner");
var scanner = new Scanner();


var debug = require('debug')('socket.io')
//////////////////////////


var clientsMap = {};

try{

  io = io.listen(8082);

}catch(error)
{
  console.log("socket.io error", error);
}


var co = require('co');
co(function* () {
    console.log("start");
    yield scanner.connect();

//////////////////////////
io.sockets.on("error", function(error){
  console.log("socket.io error", error);
});
io.sockets.on('connection', function (socket) {
  console.log("connected ",socket.id);
  clientsMap[socket.id] = {};
  socket.emit('userChanged',clientsMap); //send users list on connection
  socket.emit('status',{
    serialConnected: scanner.connected,
    laserOn:scanner.laser.isOn,
    stepperOn:scanner.turnTable.isOn,
    latestScan:scanner.latestScan,
    serialPorts:scanner.serialPorts});

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
        yield scanner.scan(parseFloat(data.stepDegrees), parseInt(data.vDpi),socket,data.debug);
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




/*var attempts = 3000;
//yield scanner.turnTable.toggle(true);
scanner.camera.connect();
for(var i=0;i<attempts;i++)
{
    //yield scanner.turnTable.rotateByDegrees(10);
    yield scanner.detectLaser();
    //scanner.camera.readTest();
    //yield sleep(10);
}*/


})();

console.log("yup");
app.listen(port);
console.log('Magic happens on port ' + port);




