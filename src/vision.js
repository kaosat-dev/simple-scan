var cv = require('opencv')

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


Vision.prototype.detectLines2 = function( imLaser, imNoLaser)
{
  console.log("starting extractLaserLine");
  var diff = new cv.Matrix(imLaser.width(), imLaser.height());
  diff.absDiff(imLaser, imNoLaser);

  var lower_threshold = [46, 0, 0];
  var upper_threshold = [150, 196, 255];
  diff.inRange(lower_threshold, upper_threshold);

  var imCanny = diff.copy();
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
  imCanny.dilate(nIters);
  imCanny.save('./frameDiffOut_Canny.png');

  console.log("finished extractLaserLine");
  return imCanny;
}


Vision.prototype.detectLines3 = function( imLaser, imNoLaser, threshold)
{
  var imLaserLine = this.extractLaserLine( imNoLaser, imLaser );
  //imLaserLine.convertHSVscale();
  var houghInput = imLaserLine;
  
  //FIXME: hack
  var lower_threshold = [46, 0, 0];
  var upper_threshold = [255, 255, 255];
  houghInput.inRange(lower_threshold, upper_threshold);
  houghInput.save("houghInput.png");
  
  //args : rho:1, theta:PI/180, threshold:80, minLineLength:30, maxLineGap:10 
  var foundLines = houghInput.houghLinesP(1,Math.PI/2,20,50,10);
  //FIXME: it seems as though the found line are already in descending order ??
  var best = foundLines.pop();
  
  if(!(best)){
     console.log("No lines found"); return null;
  }
  var cvPoint = new cv.Point(best[0],best[1]);
  var point = this.convertCvPointToPoint( cvPoint );
  return point;
}




Vision.prototype.extractLaserLine =  function(laserOff, laserOn, debug)
{
  var gaussBlurKernel = [15,15];
  var threshold = 30;
  var erosion = 2;


  var bwLaserOff = laserOff.copy();
  bwLaserOff.convertGrayscale();//convert to grayscale

  var bwLaserOn = laserOn.copy();
  bwLaserOn.convertGrayscale();//convert to grayscale

  var diffImage = new cv.Matrix(laserOn.width(), laserOn.height());
  diffImage.absDiff(bwLaserOn, bwLaserOff);//subtract both grayscales
  
  //var tresh2Image = diffImage.clone();
  
  console.log("DEBUG", debug);
  if(debug) diffImage.save("diffImage.png");
    
  //console.log("applying gaussian Blur");
  var gaussImage = diffImage.clone();
  gaussImage.gaussianBlur(gaussBlurKernel);//,cv::Size(15,15),12,12)
  
  if(debug) gaussImage.save("gaussImage.png");
  
  //var tmp = new cv.Matrix(laserOn.width(), laserOn.height());
  //tmp.absDiff(diffImage, gaussImage ); //diffImage-gaussImage
  //diffImage = tmp;
  diffImage = gaussImage;
  
  //console.log("applying threshold");
  //TODO: threshold RETURNS A NEW image
  diffImage = diffImage.threshold(threshold, 255);//apply threshold

  if(debug) diffImage.save("postThreshold.png");

  //console.log("applying erode");
  diffImage.erode( erosion );//,cv::Mat(3,3,CV_8U,cv::Scalar(1))
  if(debug) diffImage.save("diffImagePostErode.png");
  //console.log("applying canny");
  diffImage.canny( 20,50 );
  diffImage.cvtColor('CV_GRAY2BGR');
  if(debug) diffImage.save("diffImagePostCanny.png");
  
  console.log("diffImage channels", diffImage.channels());
 
  /////////
  var rows = laserOff.height(); 
  var cols = laserOff.width();

  var laserImage = laserOn.copy(); //new cv.Matrix(rows, cols);//attempted fix for node-opencv issue 
  rows = laserImage.height(); 
  cols = laserImage.width();

  var threshold = 250;//250
  var maxDist = 40;//40

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
           
          if(pixelVal>160){
             // console.log("pixelRow",diffImage.pixelRow(y));
//console.log("pixelVal",pixelVal,idx);
            //return;
          }
           if(pixelVal>threshold)
            {
             //console.log("pixelVal",pixelVal,idx);
               edges[j]=x;
               j++;
            }
        }
        /*for(var x = 0; x<cols; x++){
            //node opencv workaround
            //if(diffImage.channels()==3)
            //{
              var pixelValRaw = diffImage.pixel(y,x);
              var pixelVal=(pixelValRaw[0],pixelValRaw[1]+pixelValRaw[2])/3;

            if(pixelVal>threshold)
            {
               edges[j]=x;
               j++;
            }
        }*/
          //console.log("edges",edges);
        //iterate over detected edges, take middle of two edges
        for(var j=0; j<cols-1; j+=2){
            //
            if(edges[j]>=0 && edges[j+1]>=0 && ((edges[j+1]-edges[j])<maxDist) ) {
                var foo = edges[j]+edges[j+1]
                var middle = ~~((edges[j]+edges[j+1])/2);
                //console.log("seg", y , middle,"foo", foo,edges[j],edges[j+1],j);
                //laserImage.set(y,middle,255)//[255,255,255]);// = 255;//TODO: use pixel()??
                
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
    console.log("result channels", result.channels());
    return result;
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

  console.log("done converting from point",point," to ", cvPointX,cvPointY);
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

  console.log("done converting from cv point","{x:"+cvPoint.x+" y:"+cvPoint.y+"}"," to ", point);
  return point;
}


//compute line from points
Vision.prototype.computeLineFromPoints = function( p1, p2 )
{
  console.log("line from", p1,"to",p2);
  var l= {a:0,b:0}; //{x: 14, y: 6.4, z: 28.8 } { x: 14, y: 0, z: 0 }
  l.a = (p2.z-p1.z)/(p2.x-p1.x);
  l.b = p1.z-l.a*p1.x;

  console.log("result line", l);
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



Vision.prototype.putPointsFromFrameToCloud = function( laserOn, laserOff, dpiVertical, lowerLimit, laser, camera, turnTable, model)
{
  console.log("/////////////////");
  console.log("putPointsFromFrameToCloud");
    
  //extract laser line from the two images
  var laserLine = this.detectLines2(laserOff,laserOn);//this.extractLaserLine(laserOff,laserOn);

  //calculate position of laser in cv frame
  //position of the laser line on the back plane in world coordinates
  var cvLaserLinePosition = this.convertPointToCvPoint(laser.pointPosition);
  var laserPos = cvLaserLinePosition.x; //const over all y

  //console.log("laserPosition",laser.pointPosition, "cvLaserLinePosition",laserPos);

    //laserLine is result of subLaser2, is in RGB
    var cols = laserLine.width();//laserLine.height();
    var rows = laserLine.height();//laserLine.width();

    //create new image in black&white
    var bwImage = laserLine.copy();
    //bwImage.convertGrayscale(); 
    //bwImage.save('foobarbazBW.png');
    
    //TODO: move these to config
    var upperFrameLimit = 0;
    var lowerFrameLimit = 30;
    var laserOffset = 90;

    //console.log("CHECK: upperFrameLimit",upperFrameLimit,"rows",rows,"cols",cols,"max",rows-lowerFrameLimit);
    //now iterating from top to bottom over bwLaserLine frame
    //no bear outside of these limits :) cutting of top and bottom of frame
    for(var y = upperFrameLimit; y < rows-lowerFrameLimit; y+=dpiVertical )
    {
        //ANALYZING_LASER_OFFSET is the offset where we stop looking for a reflected laser, cos we might catch the non reflected
        //now iteratinf from right to left over bwLaserLine frame

        //console.log("X Going from ",cols-1 ,"to", laserPos+laserOffset," ////laserPos",laserPos);//+ANALYZING_LASER_OFFSET;

        for(var x = cols-1; x >= laserPos+laserOffset; x -= 1){
            var pixValue = bwImage.get(y,x);
            //if(pixValue>0)
            //{
            //console.log("Pixel value at ",y,x," is ",pixValue);
            //}
            //pixValue==255
            if(pixValue>0){ //check if white=laser-reflection
                console.log("found point at x=", x);
                //if (row[x] > 200){
                //we have a white point in the grayscale image, so one edge laser line found
                //no we should continue to look for the other edge and then take the middle of those two points
                //to take the width of the laser line into account

                //position of the reflected laser line on the image coord
                var reflectedLaserPos = new cv.Point(x,y);

                //convert to world coordinates withouth depth
                var point = this.convertCvPointToPoint(reflectedLaserPos);
                //console.log("convertedPoint", point);

                var l1 = this.computeLineFromPoints(camera.position, point);
                var l2 = this.computeLineFromPoints(laser.position, laser.pointPosition);

                var intersection = this.computeIntersectionOfLines(l1, l2);
                point.x = intersection.x;
                point.z = intersection.z;

                //console.log("intersection at , point so far:", intersection,point);

                //At this point we know the depth=z. Now we need to consider the scaling depending on the depth.
                //First we move our point to a camera centered cartesion system.
                point.y -= camera.position.y;
                point.y *= (camera.position.z - point.z)/(camera.position.z);
                //Redo the translation to the box centered cartesion system.
                point.y += camera.position.y;

                //console.log("geting color, point so far:", point);
                //get color from picture without laser
                var r = laserOff.get(y,x)[2];
                var g = laserOff.get(y,x)[1];
                var b = laserOff.get(y,x)[0];
                //point.color = FSMakeColor(r, g, b);

                //turning new point according to current angle of turntable
                //translate coordinate system to the middle of the turntable
                //console.log("computing, based on angle, point so far:", point);
                point.z -= turnTable.position.z; //7cm radius of turntbale plus 5mm offset from back plane
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

                //console.log("point.y",point.y,"lowerLimit",lowerLimit,'hypotenuse',hypotenuse);

                if(point.y>lowerLimit+0.5 && hypotenuse < 7){ //eliminate points from the grounds, that are not part of the model
                    console.log("adding new point to thingamagic",point);
                    model.push( point );
                    //model->addPointToPointCloud(point);
                }
                break;
                
            }
        }
    }

}

module.exports = Vision;

