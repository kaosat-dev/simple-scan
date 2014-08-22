var Q = require('q');
var serialPort = require("serialport");
var SerialPort = serialPort.SerialPort;


function sleep(millis) {
  var deferredResult = Q.defer();
  setTimeout(function() {
    deferredResult.resolve();
  }, millis);
  return deferredResult.promise;
};

/////////

var Scanner =function(){

  this.serial = new SerialPort("/dev/ttyACM0", {
      baudrate: 9600,
      parser: serialPort.parsers.raw
    },false);

}

Scanner.prototype={};

Scanner.prototype.foobar=function* ()
{
  console.log("entered");
  console.log('I kill an ant');
  yield {a:"54"}; // the yield keyword requires a value, so I put null
  console.log('and realize my three children');
  yield null;
  console.log('have been watching.');
  yield null;
  console.log('- Kato Shuson');
  return "45";
}

Scanner.prototype.connect=function*()
{
  var serialConnect = Q.nbind(this.serial.open, this.serial);
  yield serialConnect();
  console.log("serial connected");
  yield sleep(500);
}

//send command to arduino, wait for ack
Scanner.prototype.sendCommand=function(command)
{
  var deferred = Q.defer();
  var callback = function(response) {
    console.log("waiting for data", response, response.toJSON());
        if (response.toJSON()[0] == 213) {
          console.log("oh yeah");
            // This is our frame's response. Resolve the promise.
            deferred.resolve("ok");
        } else if (response.toJSON()[0] == 211) {
              deferred.resolve("ok");
            }
  };
  this.serial.on("data", callback);
  console.log("sending command");
  this.serial.write( new Buffer(command) );
  console.log("waiting for response to command");
  return deferred.promise; 
}

//detect laser line
Scanner.prototype.detectLaser = function *()
{
    console.log("attempting laser detection");
    var threshold = 40;
    //make sure laser is off
    yield this.sendCommand([200]);
    yield sleep(200);

    /*yield readCamera();//empty buffer?
    var im = yield readCamera();
    yield sleep(200);
    im.rotate(180);
    im.save(outputFolder+'/camNoLaser'+i+'.png');*/

    //make sure laser is on
    yield this.sendCommand([201]);
    yield sleep(200);

    /*yield readCamera();//FIXME: flush previous frame :
    var im2 = yield readCamera();
    console.log("got camera image with laser");
    im2.rotate(180);
    im2.save('camLaser.png');*/

    //cv::resize( laserOnFrame,laserOnFrame,cv::Size(1280,960) );
    //cv::resize( laserOffFrame,laserOffFrame,cv::Size(1280,960) );
    console.log("frames grabbed, now detecting...");

    /*vision.detectLaserLine( im, im2, threshold );
    if(p.x == 0.0){return false;}
    laser.setLaserPointPosition(p);
    return true;*/
}

//module.exports = Scanner;


var co = require('co');

function sleep2 (ms) {
  return function (fn) {
    setTimeout(fn, ms);
  };
}
var scanner = new Scanner();
co(function* () {

  console.log("start");
  yield scanner.connect();
  yield scanner.detectLaser();



console.log("done");
})();

/*
Q.async(function*() {
    console.log("start");
    
    //yield scanner.foobar();
    var u = yield scanner.foobar();
    //u.next();
    //yield sleep(5000);
})().done();*/
