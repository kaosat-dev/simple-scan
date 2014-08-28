var Vision = require("../src/vision");
var cv = require("opencv");
var Q = require('q');
var co = require('co');

var readCamera    = Q.nbind(cv.readImage, cv);

describe("vision class specs", function() {
  var vision = new Vision();

  beforeEach(function() {
  });


  /*it("should convert our custom points to opencv points", function() {
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
  
  */
  it("can extract laser lines using two input images/matrices", function(done) {
  
    co(function* (){

     var imLaser = yield readCamera('testData/calib_camLaser.png');
     var imNoLaser = yield readCamera('testData/calib_camNoLaser.png');
     var bestMatch = vision.extractLaserLine( imNoLaser, imLaser, true );
     
     //var foo = vision.detectLines3( imNoLaser, imLaser );
     
     done();
    })();
  });
  
  /*
  it("can detect laser lines using two input images/matrices", function(done) {
  
    co(function* (){

      var imLaser = yield readCamera('testData/calib_camLaser.png');
      var imNoLaser = yield readCamera('testData/calib_camNoLaser.png');

      var bestMatch = vision.detectLines(imLaser, imNoLaser, 10, true);
      done();
      })();
  });*/
  
 
 
 
  
});



//TODO : create test for line determination with this test data{x: 14, y: 6.4, z: 28.8 } { x: 14, y: 0, z: 0 }
