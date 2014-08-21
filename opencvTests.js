var cv = require('opencv');
//serial stuff
var serialPort = require("serialport");
var SerialPort = serialPort.SerialPort
var camera = new cv.VideoCapture(0);



function onOffLaserTest()
{
    var serial = new SerialPort("/dev/ttyACM0", {
      baudrate: 9600,
      parser: serialPort.parsers.raw
    });

    serial.on("open", function () {

    //save image without laser
    camera.read(function(err, im) {
        console.log("saving image without laser");
        im.rotate(180);
	    im.save('camNoLaser.png');
    
        console.log("toggling laser");
        //turn laser on
         serial.write(new Buffer([201]), function(err, results) {
            console.log('err3 ' + err);
            console.log('sent ' + results);

             //save image with laser
            camera.read(function(err, im) {
                console.log("saving image with laser");
                im.rotate(180);
	            im.save('camLaser.png');
                serial.write(new Buffer([200]), function(err, results) {
                    console.log('err3 ' + err);
                    console.log('sent ' + results);
                    return;
                });
            });

          });
        });

    });


}

onOffLaserTest();

