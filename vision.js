var cv = require('opencv')

//////////////////////////
var Vision = function()
{
  this.camWidth = 640;
  this.camHeight= 480; 

  this.origin = new cv.Point(0,0.75);
}

Vision.prototype={};

Vision.prototype.detectLines = function( laserOn, laserOff, threshold)
{
  var diff = new cv.Matrix(im.width(), im.height());
  diff.absDiff(laserOn, laserOff);

  var lower_threshold = [46, 0, 0];
  var upper_threshold = [150, 196, 255];
  diff.inRange(lower_threshold, upper_threshold);

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

  if(foundLines.length==0) console.log("No lines found"); return null;
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
  origin.y = this.camHeight*FSController::config->ORIGIN_Y;

  var cvPoint = new cv.Point();

  cvPoint.x = point.x*this.camWidth/fsImageSize.width
  cvPoint.y = -point.y*this.camHeight/fsImageSize.height;

  //translate
  cvPoint.x += origin.x;
  cvPoint.y += origin.y;
  return cvPoint;
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
    unsigned int cols = laserLine.cols;
    unsigned int rows = laserLine.rows;
    //create new image in black&white
    cv::Mat bwImage( cols,rows,CV_8U,cv::Scalar(100) );
    //qDebug("still works here");
    //convert from rgb to b&w
    cv::cvtColor(laserLine, bwImage, CV_RGB2GRAY); //convert to grayscale
    //now iterating from top to bottom over bwLaserLine frame
    //no bear outside of these limits :) cutting of top and bottom of frame
    for(int y = FSController::config->UPPER_ANALYZING_FRAME_LIMIT;
        y < bwImage.rows-(FSController::config->LOWER_ANALYZING_FRAME_LIMIT);
        y+=dpiVertical )
    {
        //qDebug() << "checking point at line " << y << laserPos+ANALYZING_LASER_OFFSET;
        //ANALYZING_LASER_OFFSET is the offset where we stop looking for a reflected laser, cos we might catch the non reflected
        //now iteratinf from right to left over bwLaserLine frame
        for(int x = bwImage.cols-1;
            x >= laserPos+FSController::config->ANALYZING_LASER_OFFSET;
            x -= 1){
            //qDebug() << "Pixel value: " << bwImage.at<uchar>(y,x);
            if(bwImage.at<uchar>(y,x)==255){ //check if white=laser-reflection
                //qDebug() << "found point at x=" << x;
                //if (row[x] > 200){
                //we have a white point in the grayscale image, so one edge laser line found
                //no we should continue to look for the other edge and then take the middle of those two points
                //to take the width of the laser line into account

                //position of the reflected laser line on the image coord
                CvPoint cvNewPoint;
                cvNewPoint.x = x;
                cvNewPoint.y = y;
                //cout << x << ":" << y << endl;

                //convert to world coordinates withouth depth
                FSPoint fsNewPoint = FSVision::convertCvPointToFSPoint(cvNewPoint);
                //cout << fsNewPoint.x << ":" << fsNewPoint.y << ":" << fsNewPoint.z << endl;
                FSLine l1 = computeLineFromPoints(webcam->getPosition(), fsNewPoint);
                FSLine l2 = computeLineFromPoints(laser->getPosition(), laser->getLaserPointPosition());

                FSPoint i = computeIntersectionOfLines(l1, l2);
                fsNewPoint.x = i.x;
                fsNewPoint.z = i.z;


                //At this point we know the depth=z. Now we need to consider the scaling depending on the depth.
                //First we move our point to a camera centered cartesion system.
                fsNewPoint.y -= (webcam->getPosition()).y;
                fsNewPoint.y *= ((webcam->getPosition()).z - fsNewPoint.z)/(webcam->getPosition()).z;
                //Redo the translation to the box centered cartesion system.
                fsNewPoint.y += (webcam->getPosition()).y;
                //cout << __PRETTY_FUNCTION__ << fsNewPoint.y << endl;

                //get color from picture without laser
                FSUChar r = laserOff.at<cv::Vec3b>(y,x)[2];
                FSUChar g = laserOff.at<cv::Vec3b>(y,x)[1];
                FSUChar b = laserOff.at<cv::Vec3b>(y,x)[0];
                fsNewPoint.color = FSMakeColor(r, g, b);

                //turning new point according to current angle of turntable
                //translate coordinate system to the middle of the turntable
                fsNewPoint.z -= FSController::config->TURNTABLE_POS_Z; //7cm radius of turntbale plus 5mm offset from back plane
                FSPoint alphaDelta = turntable->getRotation();
                FSFloat alphaOld = (float)atan(fsNewPoint.z/fsNewPoint.x);
                FSFloat alphaNew = alphaOld+alphaDelta.y*(M_PI/180.0f);
                FSFloat hypotenuse = (float)sqrt(fsNewPoint.x*fsNewPoint.x + fsNewPoint.z*fsNewPoint.z);

                if(fsNewPoint.z < 0 && fsNewPoint.x < 0){
                    alphaNew += M_PI;
                }else if(fsNewPoint.z > 0 && fsNewPoint.x < 0){
                    alphaNew -= M_PI;
                }
                fsNewPoint.z = (float)sin(alphaNew)*hypotenuse;
                fsNewPoint.x = (float)cos(alphaNew)*hypotenuse;

                if(fsNewPoint.y>lowerLimit+0.5 && hypotenuse < 7){ //eliminate points from the grounds, that are not part of the model
                    //qDebug("adding point");
                    model->addPointToPointCloud(fsNewPoint);
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

