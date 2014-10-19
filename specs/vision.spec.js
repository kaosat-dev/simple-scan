var Minilog=require("minilog");
var Vision = require("../app/server/vision");
var cv = require("opencv");
var Q = require('q');
var co = require('co');
var yaml       = require('js-yaml');
var fs = require('fs');


var config = yaml.safeLoad(fs.readFileSync("app/server/config.default.yml", 'utf8'));

var readCamera    = Q.nbind(cv.readImage, cv);



describe("vision class specs", function() {
  var vision = new Vision(config);

  beforeEach(function() {
  });


  it("should convert our custom points to opencv points", function() {
      var point = {x:3,y:7,z:2};
      var cvPoint = vision.convertPointToCvPoint( point );
      //no access to opencv point innards, workaround
      expect(cvPoint.x).toEqual( 784.3609008789062 );
      expect(cvPoint.y).toEqual( 383.15789794921875 );
  });
  
  it("should convert opencv points to 3d points", function() {
      var cvPoint = new cv.Point(2,7);
      var point = vision.convertCvPointToPoint(cvPoint);
      expect(point).toEqual( { x : -13.2584375, y : 14.817031250000003, z : 0 } );
  });
  
  it("should compute lines from 2 points", function() {
    
      var p1 = {x:10,y:37.2,z:0.2};
      var p2 = {x:-3.6,y:7,z:2};
      var line = vision.computeLineFromPoints(p1,p2);
      expect(line).toEqual({ a : -0.1323529411764706, b : 1.5235294117647058 });
  });
  
  it("should compute intersections between lines correctly", function() {
    
      var l1 = {a:10,b:37.2};
      var l2 = {a:-3.6,b:7};
      var intersection = vision.computeIntersectionOfLines(l1,l2);
      expect(intersection).toEqual({ x : -2.2205882352941178, y : 0, z : 14.994117647058825 });
  });
  
  it("can extract laser lines using two input images/matrices", function(done) {
    var tgtWidth = 640//160;
    var tgtHeight = 480//120;
    var debug = false;
    
    co(function* (){
    try
    {
     var imLaser = yield readCamera('specs/data/calib_camLaser.png');
     var imNoLaser = yield readCamera('specs/data/calib_camNoLaser.png');
     //imLaser.resize(tgtWidth,tgtHeight);
     //imNoLaser.resize(tgtWidth,tgtHeight);
     var laserLine = vision.extractLaserLine( imNoLaser, imLaser, debug );
     //TODO: how to compare ??
    }
    catch(error)
    {
      console.log("error",error);
      throw error;
    }
     done();
    })();
  });
  
  /*
  it("can detect laser lines using two input images/matrices", function(done) {
     co(function* (){

        try
        {
          var imLaser = yield readCamera('testData/calib_camLaser.png');
          var imNoLaser = yield readCamera('testData/calib_camNoLaser.png');

          var bestMatch = vision.detectLaserLine(imLaser, imNoLaser, 10, true);
          expect(bestMatch).toEqual({ x: -1.84953125, y: 4.6342187500000005, z: 0 });
        }
        catch(error)
        {
          console.log("error",error);
        }

      done();
          })();
  });*/

  it("can extract 3d points from images", function(done) {
    var debug = false;  
    co(function* (){
      try
      {
       var imLaser = yield readCamera('specs/data/calib_camLaser.png');
       var imNoLaser = yield readCamera('specs/data/calib_camNoLaser.png');
  
       var Laser = require("../app/server/laser");
       var Camera = require("../app/server/camera");
       var TurnTable = require("../app/server/turntable");


       var laser = new Laser(null, config);
       var camera = new Camera(1,config);
       var turnTable = new TurnTable(null, config);
       
       
       Minilog.suggest.clear().deny('camera', 'error')
        .deny('laser', 'error')
        .deny('vision', 'error')
        .deny('turntable', 'error')
        .deny('scanner', 'error');
        Minilog.enable();
       
       
       //laserOn, laserOff, dpiVertical, lowerLimit, laser, camera, turnTable, model
       laser.pointPosition = { x: -1.84953125, y: 4.6342187500000005, z: 0 };

       var resultModel = {positions:[],colors:[]};
       var expModel = JSON.parse( fs.readFileSync( 'specs/data/exp_3dExtract.json' ) );

       //laserOff, laserOn,  dpiVertical, lowerLimit, laser, camera, turnTable, model
       vision.putPointsFromFrameToCloud( imNoLaser, imLaser, 1,0,laser,camera,turnTable,resultModel );
       expect(resultModel).toEqual( expModel );
       //fs.writeFileSync(, JSON.stringify(resultModel));
      }
      catch(error)
      {
        console.log("error",error);
        throw error;
      }
     
      done();
    })();
  });

  
});



//TODO : create test for line determination with this test data{x: 14, y: 6.4, z: 28.8 } { x: 14, y: 0, z: 0 }
