var Q = require('q');
var cv = require('opencv');
//serial stuff
var serialPort = require("serialport");
var SerialPort = serialPort.SerialPort

/*function* generatorFn () {
  console.log('look ma I was suspended')
}
var generator = generatorFn() // [1]
setTimeout(function () {
  generator.next() // [2]
}, 2000)

function* HelloGen() {
  yield 100;
  yield 400;
}
var gen = HelloGen();
console.log(gen.next());
console.log(gen.next());*/

//cv.readImage

function sleep(millis) {
  var deferredResult = Q.defer();
  setTimeout(function() {
    deferredResult.resolve();
  }, millis);
  return deferredResult.promise;
};


Q.async(function*() {
    console.log("start");
    var readImage    = Q.nbind(cv.readImage, cv);
    var lower_threshold = [46, 0, 0];
    var upper_threshold = [150, 196, 255];

    var im = yield readImage( './testData/frameDiff.png' );
	  im.inRange(lower_threshold, upper_threshold);
	  //im.threshold( 200,200 ) ;
	  im.save('./frameDiffOut.png');

})().done();
return;


Q.async(function*() {
    console.log("start");
    var camera = new cv.VideoCapture(0);
    var serial = new SerialPort("/dev/ttyACM0", {
      baudrate: 9600,
      parser: serialPort.parsers.raw
    },false);

    var serialConnect = Q.nbind(serial.open, serial);
    var serialWrite   = Q.nbind(serial.write, serial);
    var serialOn      = Q.nbind(serial.on, serial);
    var readCamera    = Q.nbind(camera.read, camera);

    yield serialConnect();
    serialOn("data").then(function(bla){console.log("bla",bla)});
    //var ack = yield serialOn("data");
    //console.log("serial connected", ack);
    yield sleep(1000);

    var im = yield readCamera();
    console.log("got camera image without laser");
    im.rotate(180);
    im.save('camNoLaser.png');

    console.log("toggling laser");
    yield serialWrite(new Buffer([201]));
    yield sleep(500);
    yield readCamera();//FIXME: flush previous frame :
    var im2 = yield readCamera();
    console.log("got camera image with laser");
    im2.rotate(180);
    im2.save('camLaser'+i+'.png');

    var diff = new cv.Matrix(im.width(), im.height());
    diff.absDiff(im, im2);
    diff.save('frameDiff.png');

    //from node opencv examples
    var imCanny = diff.copy();
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
	all.save('./all.png');

    /*
    for(var i = 0; i<30;i++)
    {
        var im2 = yield readCamera();
        console.log("got camera image with laser");
        im2.rotate(180);
	    im2.save('camLaser'+i+'.png');
    }*/
    console.log("toggling laser off");
    yield serialWrite(new Buffer([200]));
})().done();
