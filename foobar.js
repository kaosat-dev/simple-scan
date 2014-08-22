var Q = require('q');
var cv = require('opencv');
//serial stuff
var serialPort = require("serialport");
var SerialPort = serialPort.SerialPort


function sleep(millis) {
  var deferredResult = Q.defer();
  setTimeout(function() {
    deferredResult.resolve();
  }, millis);
  return deferredResult.promise;
};




var offline = Q.async(function*() {
    console.log("start");
    var readImage    = Q.nbind(cv.readImage, cv);
    var lower_threshold = [46, 0, 0];
    var upper_threshold = [150, 196, 255];

    var im = yield readImage( './testData/frameDiff.png' );
    im.inRange(lower_threshold, upper_threshold);
    //im.threshold( 200,200 ) ;
    im.save('./frameDiffOut.png');

    //from node opencv examples
    var imCanny = im.copy();
    //imCanny.convertGrayscale();
    var lowThresh = 50;
    var highThresh = 200;
    var nIters = 1;
    var maxArea = 2500;

    var GREEN = [0, 255, 0]; //B, G, R
    var WHITE = [255, 255, 255]; //B, G, R
    var RED   = [0, 0, 255]; //B, G, R
    var BLUE   = [255, 0, 0]; //B, G, R
    imCanny.canny(lowThresh, highThresh,3);
	  //imCanny.dilate(nIters);
    imCanny.save('./frameDiffOut_Canny.png');


    var houghInput = im;
    var outputDebug = yield readImage( './testData/camLaser.png' );
    //var outputDebug = new cv.Matrix(im.height(), im.width()); 
    //args : rho:1, theta:PI/180, threshold:80, minLineLength:30, maxLineGap:10 
    var foundLines = houghInput.houghLinesP(0.1,Math.PI/180,30,1,30);
    //FIXME: it seems as though the found line are already in descending order ??
    var longest = null;
    var curLng = Number.NEGATIVE_INFINITY;
    for(var i=0;i<foundLines.length;i++)
    {
      var cur = foundLines[i];
      var x1 = cur[0];
      var y1 = cur[1];
      var x2 = cur[2];
      var y2 = cur[3];

      var lngSqrt= (x2-x1)*(x2-x1) + (y2-y1)*(y2-y1);
      console.log("current", lngSqrt, "curLng", curLng);
      if(lngSqrt>=curLng) {curLng = lngSqrt; longest=i;}
      //outputDebug.line([cur[0],cur[1]], [cur[2], cur[3]],BLUE)
    }
    console.log(foundLines);
    console.log("longest", longest);
    var cur = foundLines[longest];
    outputDebug.line([cur[0],cur[1]], [cur[2], cur[3]],RED)
    

    //draw calibration lines
    //horizontal, center
    outputDebug.line([0,im.height()/2],[im.width(),im.height()/2],GREEN);
    //vertical, center
    outputDebug.line([im.width()/2,0],[im.width()/2,im.height()],GREEN);
    //horizontal turntable center
    outputDebug.line([0,im.height()/1.33],[im.width(),im.height()/1.33],WHITE);

    outputDebug.save('./frameDiffOut_houghLinesP.png');
    

//args : rho:1, theta:PI/180, threshold:80, minLineLength:30, maxLineGap:10 
/*double rho = args.Length() < 1 ? 1 : args[0]->NumberValue();
  double theta = args.Length() < 2 ? CV_PI/180 : args[1]->NumberValue();
  int threshold = args.Length() < 3 ? 80 : args[2]->Uint32Value();
  double minLineLength = args.Length() < 4 ? 30 : args[3]->NumberValue();
  double maxLineGap = args.Length() < 5 ? 10 : args[4]->NumberValue();
*/

})



var online = Q.async(function*() {
    console.log("start");
    var camera = new cv.VideoCapture(0);
    var serial = new SerialPort("/dev/ttyACM0", {
      baudrate: 9600,
      parser: serialPort.parsers.raw
    },false);


    function sendCommand(command)
    {
      var deferred = Q.defer();
      var callback = function(response) {
        console.log("waiting for data", response, response.toJSON());
            if (response.toJSON()[0] == 213) {
              console.log("oh yeah");
                // This is our frame's response. Resolve the promise.
                deferred.resolve("ok");
            }
      };

      serial.on("data", callback);
      console.log("sending command");
      serial.write( new Buffer(command) );
      console.log("waiting for response to command");
      return deferred.promise; 
    }

    var serialConnect = Q.nbind(serial.open, serial);
    var serialWrite   = Q.nbind(serial.write, serial);
    var serialOn      = Q.nbind(serial.on, serial);
    var readCamera    = Q.nbind(camera.read, camera);

    yield serialConnect();
    //serialOn("data").then(function(bla){console.log("bla",bla)});
    //var ack = yield serialOn("data");
    //console.log("serial connected", ack);
    yield sleep(500);

    yield readCamera();
    var im = yield readCamera();
    console.log("got camera image without laser");
    im.rotate(180);
    im.save('camNoLaser.png');

    
    console.log("toggling laser");
    yield sendCommand([201]);
    yield readCamera();//FIXME: flush previous frame :
    var im2 = yield readCamera();
    console.log("got camera image with laser");
    im2.rotate(180);
    im2.save('camLaser.png');

    var diff = new cv.Matrix(im.width(), im.height());
    diff.absDiff(im, im2);
    diff.save('frameDiff.png');

    console.log("toggling laser off");
    yield sendCommand([200]);


    console.log("starting scan");
    var outputFolder = "./scanData";

    var scanRange = 360; //in degrees
    var scanEvery = 15; //every how many degrees do we get data-> lower is higher quality
    
    var stepsPerRot = 400; //steps per 360 deg turn
    
    var startAngle = 0;
    var currentAngle = 0;
    var turnTableSteps = stepsPerRot/360*scanEvery;
    var totalScans = scanRange/scanEvery;
    console.log("turnTableSteps",turnTableSteps,"totalScans",totalScans);
    
    //turn stepper on 
    yield sendCommand([205]);
    //set clockwise
    yield sendCommand([203]);
    for(var i=startAngle;i<scanRange;i+=scanEvery)
    {
      yield readCamera();
      var im = yield readCamera();
      //yield sleep(200);
      im.rotate(180);
      im.save(outputFolder+'/camNoLaser'+i+'.png');
      yield sendCommand([201]);

      yield readCamera();
      var im = yield readCamera();
      //yield sleep(200);
      im.rotate(180);
      im.save(outputFolder+'/camLaser'+i+'.png');
      yield sendCommand([200]);


      yield sendCommand([202,turnTableSteps]);
      currentAngle+= i;
    }

    //turn stepper off 
    yield sendCommand([206]);

    console.log("done with scan");

    //from node opencv examples
    /*var imCanny = diff.copy();
    imCanny.convertGrayscale();
    var lowThresh = 45;
    var highThresh = 200;
    var nIters = 1;
    var maxArea = 2500;

    var GREEN = [0, 255, 0]; //B, G, R
    var WHITE = [255, 255, 255]; //B, G, R
    var RED   = [0, 0, 255]; //B, G, R
    imCanny.canny(lowThresh, highThresh);
	  imCanny.dilate(nIters);
    imCanny.save('frameDiff_Canny.png');


    var big = new cv.Matrix(im.height(), im.width()); 
	  var all = new cv.Matrix(im.height(), im.width()); 
    contours = imCanny.findContours();

	  for(i = 0; i < contours.size(); i++) {
		  if(contours.area(i) > maxArea) {
			  var moments = contours.moments(i);
			  var cgx = Math.round(moments.m10/moments.m00);
			  var cgy = Math.round(moments.m01/moments.m00);
			  big.drawContour(contours, i, GREEN);
			  big.line([cgx - 5, cgy], [cgx + 5, cgy], RED);
			  big.line([cgx, cgy - 5], [cgx, cgy + 5], RED);
		  }
	}

	all.drawAllContours(contours, WHITE);
	big.save('./big.png');
	all.save('./all.png');*/
})


online().done();
