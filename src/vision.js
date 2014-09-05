var cv = require('opencv');
var Minilog=require("minilog");

Minilog.pipe(Minilog.suggest).pipe(Minilog.defaultFormatter).pipe(Minilog.defaultBackend);
var log = Minilog('vision');

var config = require("./config");

//////////////////////////
var Vision = function()
{
  this.camWidth = 640;
  this.camHeight= 480; 

  //TODO: make these configurable
  this.origin = new cv.Point(0,0.75);
  this.frameWidth = 26.6;
  this.camWidth = 1280 ;
  this.camHeight = 960;

  this.lineExtractionParams = {
     gaussBlurKernel : [15,15],
     threshold       : 22,
     erosion         : 2,
     dilation        : 5,
     outThreshold    : 250,
     maxDist         : 40
  }
}

Vision.prototype={};


Vision.prototype.detectLines = function( imLaser, imNoLaser, threshold, debug)
{
  var diff = new cv.Matrix(imLaser.width(), imLaser.height());
  diff.absDiff(imLaser, imNoLaser);

  var lower_threshold = [46, 0, 0];
  var upper_threshold = [100, 100, 255];
  diff.inRange(lower_threshold, upper_threshold);
  if(debug) diff.save('./detectLines_Range.png');

  var imCanny = diff.copy();
  //imCanny.convertGrayscale();
  var lowThresh = 200;
  var highThresh = 255;
  var nIters = 5;
  var maxArea = 2500;

  var GREEN = [0, 255, 0]; //B, G, R
  var WHITE = [255, 255, 255]; //B, G, R
  var RED   = [0, 0, 255]; //B, G, R
  var BLUE   = [255, 0, 0]; //B, G, R

  imCanny.dilate(nIters);
  if(debug) imCanny.save('./detectLines_dilate.png');

  imCanny.erode(6);
  if(debug) imCanny.save('./detectLines_erode.png');

  imCanny.canny(lowThresh, highThresh, 100);
  if(debug) imCanny.save('./detectLines_Canny.png');


  var houghInput = diff;
  //var outputDebug = new cv.Matrix(im.height(), im.width()); 
  //args : rho:1, theta:PI/180, threshold:80, minLineLength:30, maxLineGap:10 

  //good results with 30;1;30
  var foundLines = houghInput.houghLinesP(1,Math.PI/2,20,50,10);
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
    if(lngSqrt>=curLng) {curLng = lngSqrt; longest=i;}
  }
  console.log(foundLines);
  console.log("longest", longest);
  var best = foundLines[longest];

  if(!(best)){
     console.log("No lines found"); return null;
  }

  var cvPoint = new cv.Point(best[0],best[1]);
  var point = this.convertCvPointToPoint( cvPoint );
  //return {x:best[0],y:best[1]}
  return point;
}



Vision.prototype.detectLaserLine =  function(laserOff, laserOn, threshold, debug)
{
  var imLaserLine = this.extractLaserLine( laserOff, laserOn, debug );
  imLaserLine.convertGrayscale();
  var houghInput = imLaserLine;
  
  //args : rho:1, theta:PI/180, threshold:80, minLineLength:30, maxLineGap:10 
  var foundLines = houghInput.houghLinesP(1,Math.PI/2,20,50,10);
  console.log("foundLines",foundLines);
  var best = foundLines.pop();//TODO: it seems as though the found line are already in descending order ??
  
  if(!(best)){
     console.log("No lines found"); return null;
  }
  var cvPoint = new cv.Point(best[0],best[1]);
  var point = this.convertCvPointToPoint( cvPoint );
  return point;
}


Vision.prototype.extractLaserLine =  function(laserOff, laserOn, debug)
{
  var params = this.lineExtractionParams;
  var gaussBlurKernel = params.gaussBlurKernel;
  var threshold       = params.threshold;
  var erosion         = params.erosion;
  var dilation        = params.dilation;
  var outThreshold    = params.outThreshold;
  var maxDist         = params.maxDist;


  var bwLaserOff = laserOff.copy();
  bwLaserOff.convertGrayscale();//convert to grayscale
  if(debug) bwLaserOff.save("bwLaserOff.png");

  var bwLaserOn = laserOn.copy();
  bwLaserOn.convertGrayscale();//convert to grayscale
  if(debug) bwLaserOn.save("bwLaserOn.png");

  var diffImage = new cv.Matrix(laserOn.width(), laserOn.height());
  diffImage.absDiff(bwLaserOn, bwLaserOff);//subtract both grayscales
  
  //var tresh2Image = diffImage.clone();
  
  log.debug("DEBUG", debug);
  if(debug) diffImage.save("diffImage.png");
    
  //console.log("applying gaussian Blur");
  var gaussImage = diffImage.clone();
  gaussImage.gaussianBlur(gaussBlurKernel);
  
  if(debug) gaussImage.save("gaussImage.png");
  
  diffImage = gaussImage;
  
  //console.log("applying threshold");
  //TODO: threshold RETURNS A NEW image
  diffImage = diffImage.threshold(threshold, 255);//apply threshold

  if(debug) diffImage.save("postThreshold.png");

  diffImage.dilate( dilation );
  if(debug) diffImage.save("diffImagePostDilate.png");

  diffImage.erode( erosion );//,cv::Mat(3,3,CV_8U,cv::Scalar(1))
  if(debug) diffImage.save("diffImagePostErode.png");
  diffImage.canny( 20,50 );
  diffImage.cvtColor('CV_GRAY2BGR');
  if(debug) diffImage.save("diffImagePostCanny.png");
  
  log.debug("diffImage channels", diffImage.channels());
 
  /////////
  var rows = laserOff.height(); 
  var cols = laserOff.width();

  var laserImage = laserOn.copy(); //new cv.Matrix(rows, cols);//attempted fix for node-opencv issue 
  rows = laserImage.height(); 
  cols = laserImage.width();


  for(var y = 0; y <rows; y++){
    for(x=0; x<cols; x++){
        //laserImage.set(y,x,0); 
        laserImage.pixel(y,x,[0,0,0]); 
    }
  }
  //laserImage.save("diffResult.png");

  var testFlag = false;
  var fooBar = 0;

  var edges = new Array(cols);//int edges[cols]; //contains the cols index of the detected edges per row
    for(var y = 0; y <rows; y++){
        //reset the detected edges//initialize bg color
        for(j=0; j<cols; j++){ 
          edges[j]=-1;
          //node opencv workaround
          //laserImage.pixel(j,y,[0,0,0]); 
        }
        var pixRow = diffImage.pixelRow(y);  
        var j=0;
        for(var x = 0; x<cols; x++){
          var idx= x*3;
          var pixelValRaw = [pixRow[idx],pixRow[idx+1],pixRow[idx+2]];
          var pixelVal=(pixelValRaw[0]+pixelValRaw[1]+pixelValRaw[2])/3;
           
           if(pixelVal>outThreshold)
            {
             //console.log("pixelVal",pixelVal,idx);
               edges[j]=x;
               j++;
            }
        }
        //iterate over detected edges, take middle of two edges
        for(var j=0; j<cols-1; j+=2){
            //
            if(edges[j]>=0 && edges[j+1]>=0 && ((edges[j+1]-edges[j])<maxDist) ) {
                var foo = edges[j]+edges[j+1]
                var middle = ~~((edges[j]+edges[j+1])/2);
                //console.log("seg", y , middle,"foo", foo,edges[j],edges[j+1],j);
                //laserImage.set(y,middle,255)//[255,255,255]);// = 255;//TODO: use pixel()??
                        //now iteratinf from right to left over bwLaserLine frame
                if(laserImage.channels()==1)
                {
                  //laserImage.set(y,middle,255);
                }
                else
                {
                  laserImage.pixel(y,middle,[255,255,255]);
                }
                //
                //laserImage.rectangle([y, middle], [y, middle], [255, 255, 255], 1);
                testFlag = true;
            }
        }

        if(testFlag)
        {
          //console.log("row:",y+"/"+rows,"edges",edges);
          //break;
        }
    }
    
    //console.log("edges", edges);
    var result = laserImage.copy();
    ///result.convertGrayscale();
    if(debug) result.save("diffResult.png");

    gaussImage=null;
    bwLaserOn = null;
    bwLaserOff = null;
    laserImage = null;
    return result;
}


Vision.prototype.putPointsFromFrameToCloud = function( laserOn, laserOff, dpiVertical, lowerLimit, laser, camera, turnTable, model)
{
  log.info("////////putPointsFromFrameToCloud/////////");
    
  //extract laser line from the two images
  var laserLineIm = this.extractLaserLine(laserOff,laserOn);

  //calculate position of laser in cv frame
  //position of the laser line on the back plane in world coordinates
  var cvLaserLinePosition = this.convertPointToCvPoint(laser.pointPosition);
  var laserPos = cvLaserLinePosition.x; //constant over all y
  //console.log("laserPosition",laser.pointPosition, "cvLaserLinePosition",laserPos);

  //laserLine is result of subLaser2, is in RGB
  var cols = laserLineIm.width();//laserLine.height();
  var rows = laserLineIm.height();//laserLine.width();

  //create new image in black&white
  var bwImage = laserLineIm.copy();
  //bwImage.convertGrayscale(); 
  //bwImage.save('laserLineBW.png');
  
  //TODO: move these to config
  var upperFrameLimit = 0;
  var lowerFrameLimit = 30;
  var laserOffset = 90;
  var foundPoints = 0;
    log.debug("CHECK: upperFrameLimit",upperFrameLimit,"rows",rows,"cols",cols,"max",rows-lowerFrameLimit);
    //now iterating from top to bottom over bwLaserLine frame
    //no bear outside of these limits :) cutting of top and bottom of frame
    for(var y = upperFrameLimit; y < rows-lowerFrameLimit; y+=dpiVertical )
    {
        //ANALYZING_LASER_OFFSET is the offset where we stop looking for a reflected laser, cos we might catch the non reflected
        //now iteratinf from right to left over bwLaserLine frame

        var pixRow = bwImage.pixelRow(y);  
        var colRow = laserOff.pixelRow(y); 
        var minX = (laserPos+laserOffset);
        //console.log("X Going from ",cols-1 ,"to", minX," ////laserPos",laserPos);//+ANALYZING_LASER_OFFSET;
        //console.log("pixRow",pixRow);
        for(var x = cols-1; x >= minX; x -= 1){
            var idx= x*3;
            var pixelValRaw = [pixRow[idx],pixRow[idx+1],pixRow[idx+2]];
            var pixelVal=(pixelValRaw[0]+pixelValRaw[1]+pixelValRaw[2])/3;
            /*var pixelValRaw = bwImage.pixel(y,x);
            var pixelVal=(pixelValRaw[0]+pixelValRaw[1]+pixelValRaw[2])/3;*/
            //var pixelVal=bwImage.get(x,y);

            //if(pixelValRaw[0]==255) console.log("Pixel value at {x:"+x+',y:'+y+'} is :'+pixelValRaw);
            if(pixelVal>0)
            {
              log.debug("Pixel value at {x:"+x+',y:'+y+'} is :'+pixelVal,idx);
            }
            if(pixelVal>0){ //check if white=laser-reflection
                log.debug("found point at x= "+ x+", y="+y);
                //position of the reflected laser line on the image coord
                var reflectedLaserPos = new cv.Point(x,y);

                //convert to world coordinates withouth depth
                var point = this.convertCvPointToPoint(reflectedLaserPos);
                log.debug("convertedPoint", point);

                var l1 = this.computeLineFromPoints(camera.position, point);
                var l2 = this.computeLineFromPoints(laser.position, laser.pointPosition);

                var intersection = this.computeIntersectionOfLines(l1, l2);
                point.x = intersection.x;
                point.z = intersection.z;

                log.debug("intersection done , point so far:", point);

                //At this point we know the depth=z. Now we need to consider the scaling depending on the depth.
                //First we move our point to a camera centered cartesian system.
                point.y -= camera.position.y;
                point.y *= (camera.position.z - point.z)/(camera.position.z);
                //Redo the translation to the box centered cartesion system.
                point.y += camera.position.y;

                log.debug("adjusting for camera done , point so far:", point);

                //get color from picture without laser
                var colorValRaw = [colRow[idx],colRow[idx+1],colRow[idx+2]];
                var r = colorValRaw[2];
                var g = colorValRaw[1];
                var b = colorValRaw[0];
                log.debug("color:",r,g,b);

                //turning new point according to current angle of turntable
                //translate coordinate system to the middle of the turntable
                //console.log("computing, based on angle, point so far:", point);
                point.z -= turnTable.position.z; //7cm radius of turntbale plus 5mm offset from back plane
                //point.x -=2.5;
                //point.z -=0;
          
                var alphaDelta = turnTable.rotation;
                var alphaOld = Math.atan(point.z/point.x);
                var alphaNew = alphaOld+alphaDelta.y*(Math.PI/180.0);
                var hypotenuse = Math.sqrt(point.x*point.x + point.z*point.z);

                if(point.z < 0 && point.x < 0){
                    alphaNew += Math.PI;
                }else if(point.z > 0 && point.x < 0){
                    alphaNew -= Math.PI;
                }
                point.z = Math.sin(alphaNew)*hypotenuse;
                point.x = Math.cos(alphaNew)*hypotenuse;


                log.debug("point.y",point.y+">"+(lowerLimit+0.5),'hypotenuse',hypotenuse+"<7");// 
                if(point.y>lowerLimit+0.5&& hypotenuse < 7){ //eliminate points from the grounds, that are not part of the model
                    //log.info("adding new point to thingamagic",point);
                    log.warn(turnTable.rotation);
                    model.positions.push( point.x, point.y, point.z);
                    model.colors.push( r/255,g/255,b/255 );
                    foundPoints+=1;
                    //model->addPointToPointCloud(point);
                }
                break;
            }
        }
        log.debug(" ");
    }
    log.info("done putPointsFromFrameToCloud: points found:",foundPoints);

}



Vision.prototype.drawHelperLines = function( im )
{
  var GREEN = [0, 255, 0]; //B, G, R
  var WHITE = [255, 255, 255]; //B, G, R
  var RED   = [0, 0, 255]; //B, G, R
  var BLUE   = [255, 0, 0]; //B, G, R
  //draw calibration lines
  //horizontal, center
  im.line([0,im.height()/2],[im.width(),im.height()/2],GREEN);
  //vertical, center
  im.line([im.width()/2,0],[im.width()/2,im.height()],GREEN);
  //horizontal turntable center
  im.line([0,im.height()/1.33],[im.width(),im.height()/1.33],WHITE);
}

//convert our custom point to openCV point
Vision.prototype.convertPointToCvPoint = function( point)
{
  var fsImgWidth = this.frameWidth;
  var fsImgHeight = (this.frameWidth*(this.camHeight/this.camWidth));

  var origin = new cv.Point(this.camWidth/2.0,this.camHeight*this.origin.y);

  var cvPointX = (point.x*this.camWidth/fsImgWidth) + origin.x;
  var cvPointY = (-point.y*this.camHeight/fsImgHeight) + origin.y;
  var cvPoint = new cv.Point(cvPointX, cvPointY);

  log.debug("done converting from point",point," to ", cvPointX,cvPointY);
  return cvPoint;
}

//convert openCV to our custom point
Vision.prototype.convertCvPointToPoint = function( cvPoint)
{
  var fsImgWidth = this.frameWidth;
  var fsImgHeight = (this.frameWidth*(this.camHeight/this.camWidth));

  var origin = new cv.Point(this.camWidth/2.0,this.camHeight*this.origin.y); 

  var point= {x:0,y:0,z:0};
  point.x = (cvPoint.x - origin.x)*fsImgWidth/this.camWidth  ;
  point.y = -(cvPoint.y - origin.y)*fsImgHeight/this.camHeight;
  point.z = 0.0;

  log.debug("done converting from cv point","{x:"+cvPoint.x+" y:"+cvPoint.y+"}"," to ", point);
  return point;
}


//compute line from points
Vision.prototype.computeLineFromPoints = function( p1, p2 )
{
  log.debug("line from", p1,"to",p2);
  var l= {a:0,b:0};
  l.a = (p2.z-p1.z)/(p2.x-p1.x);
  l.b = p1.z-l.a*p1.x;

  log.debug("result line", l);
  return l;
}


//compute line intersections
Vision.prototype.computeIntersectionOfLines = function( l1, l2 )
{
  var i= {x:0,y:0};//intersection of the two coplanar lines
  i.x = (l2.b-l1.b)/(l1.a-l2.a);
  i.z = l2.a*i.x+l2.b;
  return i;
}

module.exports = Vision;

