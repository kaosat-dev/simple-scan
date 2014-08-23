var Q = require('q');

function sleep(millis) {
  var deferredResult = Q.defer();
  setTimeout(function() {
    deferredResult.resolve();
  }, millis);
  return deferredResult.promise;
};

function* foo(x) {
    yield x + 1;

    var y = yield null;
    return x + y;
}

var gen = foo(5);
console.log( gen.next()) ; // { value: 6, done: false }
gen.next(); // { value: null, done: false }
//gen.send(8); // { value: 13, done: true }


//yield sleep( 1000 );


function* haiku(){
  console.log('I kill an ant');
  yield null; // the yield keyword requires a value, so I put null
  console.log('and realize my three children');
  yield null;
  console.log('have been watching.');
  yield null;
  console.log('- Kato Shuson');
}

var g = haiku()
g.next();
g.next();
g.next();
sleep(300).next();
