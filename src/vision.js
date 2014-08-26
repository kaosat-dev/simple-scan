var cv = require('opencv')

//////////////////////////
var Vision = function()
{
  this.camWidth = 640;
  this.camHeight= 480; 

  this.origin = new cv.Point(0,0.75);
}

Vision.prototype={};

Vision.prototype.detectLines = function*( imLaser, imNoLaser, threshold)
{
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
  //imCanny.dilate(nIters);
  imCanny.save('./frameDiffOut_Canny.png');


  var houghInput = diff;
  //var outputDebug = new cv.Matrix(im.height(), im.width()); 
  //args : rho:1, theta:PI/180, threshold:80, minLineLength:30, maxLineGap:10 

  //good results with 30;1;30
  var foundLines = houghInput.houghLinesP(1,Math.PI/180,20,50,10);
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
    //outputDebug.line([cur[0],cur[1]], [cur[2], cur[3]],BLUE)
  }
  console.log(foundLines);
  console.log("longest", longest);
  var best = foundLines[longest];
  //outputDebug.line([cur[0],cur[1]], [cur[2], cur[3]],RED);

  if(!(best)){
     console.log("No lines found"); return null;
  }
  return {x:best[0],y:best[1]}
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

Vision.prototype.convertPointToCvPoint = function( point)
{
  /*FSSize fsImageSize = FSMakeSize(
              FSController::config->FRAME_WIDTH,
              FSController::config->FRAME_WIDTH*(
                  FSController::config->CAM_IMAGE_HEIGHT/FSController::config->CAM_IMAGE_WIDTH), 0.0f);*/

  var origin= new cv.Point();
  origin.x = this.camWidth/2.0;
  origin.y = this.camHeight*this.origin.y;//FSController::config->ORIGIN_Y;

  var cvPoint = new cv.Point();

  cvPoint.x = point.x*this.camWidth/fsImageSize.width
  cvPoint.y = -point.y*this.camHeight/fsImageSize.height;

  //translate
  cvPoint.x += origin.x;
  cvPoint.y += origin.y;
  return cvPoint;
}
  

Vision.prototype.extractLaserLine =  function(laserOff,laserOn)
{
  
  var bwLaserOff = laserOff.copy();
  bwLaserOff.convertGrayscale();//convert to grayscale

  var bwLaserOn = laserOn.copy();
  bwLaserOn.convertGrayscale();//convert to grayscale

  var diffImage = new cv.Matrix(imLaser.width(), imLaser.height());
  diffImage.absDiff(bwLaserOn, bwLaserOff);//subtract both grayscales

  var tresh2Image = diffImage.clone();

  var gaussImage = diffImage.clone();
  gaussImage.gaussianBlur([15,15]);//,cv::Size(15,15),12,12)

  diffImage = diffImage.absDiff( gaussImage ); //diffImage-gaussImage

  var threshold = 10;

  diffImage.threshold(threshold,255,0);//cv::THRESH_TOZERO); //apply threshold
  diffImage.erode( 3 );//,cv::Mat(3,3,CV_8U,cv::Scalar(1))
  diffImage.canny( 20,50 );


  var rows = laserOff.width();
  var cols = laserOff.height();
  /////////

  var laserImage = new cv.Matrix(imLaser.width(), imLaser.height());

  var edges = new cv.Matrix(1,cols);
    //int edges[cols]; //contains the cols index of the detected edges per row
    for(var y = 0; y <rows; y++){
        //reset the detected edges
        for(j=0; j<cols; j++){ edges[j]=-1; }
        var j=0;
        for(var x = 0; x<cols; x++){
            if(diffImage.get(y,x)>250){
                edges[j]=x;
                j++;
            }
        }
        //iterate over detected edges, take middle of two edges
        for(var j=0; j<cols-1; j+=2){
            if(edges[j]>=0 && edges[j+1]>=0 && edges[j+1]-edges[j]<40){
                var middle = parseInt( (edges[j]+edges[j+1])/2 );
                //qDebug() << cols << rows << y << middle;
                laserImage.set(y,middle,255)//[255,255,255]);// = 255;//TODO: use pixel()??
            }
        }
    }
    //cv::cvtColor(laserImage, result, CV_GRAY2RGB); //convert back ro rgb
    return result;
}

Vision.prototype.putPointsFromFrameToCloud = function( laserOn, laserOff, dpiVertical, lowerLimit, laserPosition)
{
  console.log("putPointsFromFrameToCloud");
    
  //extract laser line from the two images
  var laserLine = this.extractLaserLine(laserOff,laserOn);

  //calculate position of laser in cv frame
  //position of the laser line on the back plane in world coordinates
  var cvLaserLinePosition = convertFSPointToCvPoint(laserPosition);
  var laserPos = cvLaserLinePosition.x; //const over all y

    //laserLine is result of subLaser2, is in RGB
    var cols = laserLine.cols;
    var rows = laserLine.rows;
    //create new image in black&white
    var bWImage = new cv.Matrix(im.height(), im.width()); 
    //cv::Mat bwImage( cols,rows,CV_8U,cv::Scalar(100) );
    
    //convert from rgb to b&w
    //cv::cvtColor(laserLine, bwImage, CV_RGB2GRAY); //convert to grayscale
    
    var upperFrameLimit = 0;
    var lowerFrameLimit = 0;
    var laserOffset = 0;
    var turnTable = {};
    //now iterating from top to bottom over bwLaserLine frame
    //no bear outside of these limits :) cutting of top and bottom of frame
    for(var y = upperFrameLimit; y < bwImage.rows-lowerFrameLimit; y+=dpiVertical )
    {
        //console.log"checking point at line " << y << laserPos+ANALYZING_LASER_OFFSET;
        //ANALYZING_LASER_OFFSET is the offset where we stop looking for a reflected laser, cos we might catch the non reflected
        //now iteratinf from right to left over bwLaserLine frame
        for(var x = bwImage.cols-1; x >= laserPos+laserOffset; x -= 1){
            //console.log"Pixel value: " << bwImage.at<uchar>(y,x);
            if(bwImage.at(y,x)==255){ //check if white=laser-reflection
                //console.log"found point at x=" << x;
                //if (row[x] > 200){
                //we have a white point in the grayscale image, so one edge laser line found
                //no we should continue to look for the other edge and then take the middle of those two points
                //to take the width of the laser line into account

                //position of the reflected laser line on the image coord
                var reflectedLaserPos = new cv.Point(x,y);

                //convert to world coordinates withouth depth
                var point = this.convertCvPointToFSPoint(reflectedLaserPos);
                //console.log("convertedPoint", point);
                var l1 = computeLineFromPoints(webcam.getPosition(), point);
                var l2 = computeLineFromPoints(laser.getPosition(), laser.getLaserPointPosition());

                var intersection = computeIntersectionOfLines(l1, l2);
                point.x = intersection.x;
                point.z = intersection.z;


                //At this point we know the depth=z. Now we need to consider the scaling depending on the depth.
                //First we move our point to a camera centered cartesion system.
                point.y -= webcam.position.y;
                point.y *= (webcam.position.z - point.z)/(webcam.position.z);
                //Redo the translation to the box centered cartesion system.
                point.y += webcam.position.y;

                //get color from picture without laser
                var r = laserOff.at(y,x)[2];
                var g = laserOff.at(y,x)[1];
                var b = laserOff.at(y,x)[0];
                point.color = FSMakeColor(r, g, b);

                //turning new point according to current angle of turntable
                //translate coordinate system to the middle of the turntable
                point.z -= turntable.position.z; //7cm radius of turntbale plus 5mm offset from back plane
                var alphaDelta = turntable.rotation;
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

                if(point.y>lowerLimit+0.5 && hypotenuse < 7){ //eliminate points from the grounds, that are not part of the model
                    console.log("adding new point to thingamagic",point);
                    //model->addPointToPointCloud(point);
                }
                break;
            }
        }
    }

}
/*//points must have same height
static FSLine computeLineFromPoints(FSPoint p1, FSPoint p2)
{
  FSLine l;
  l.a = (p2.z-p1.z)/(p2.x-p1.x);
  l.b = p1.z-l.a*p1.x;
  return l;
}

//lines must be on same plane
static FSPoint computeIntersectionOfLines(FSLine l1, FSLine l2)
{
  FSPoint i; //intersection of the two coplanar lines
  i.x = (l2.b-l1.b)/(l1.a-l2.a);
  i.z = l2.a*i.x+l2.b;
  return i;
}*/
module.exports = Vision;

