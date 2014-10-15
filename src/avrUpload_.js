var avrUploader, pageBytes;



pageBytes = 128;

avrUploader = function(serial, bytes, tty, cb) {
  var done, next, offset, reply, serial, state, states, timer;
  done = function(err) {
    return serial.close(function() {
      return cb(err);
    });
  };
  timer = null;
  state = offset = 0;
  reply = '';
  states = [
    function() {
      return ['0 '];
    }, function() {
      var buf;
      buf = new Buffer(20);
      buf.fill(0);
      buf.writeInt16BE(pageBytes, 12);
      return ['B', buf, ' '];
    }, function() {
      return ['P '];
    }, function() {
      var buf;
      if (offset >= bytes.length) {
        state += 1;
      }
      buf = new Buffer(2);
      buf.writeInt16LE(offset >> 1, 0);
      return ['U', buf, ' '];
    }, function() {
      var buf, count, pos;
      state -= 2;
      count = Math.min(bytes.length - offset, pageBytes);
      buf = new Buffer(2);
      buf.writeInt16BE(count, 0);
      pos = offset;
      offset += count;
      return ['d', buf, 'F', bytes.slice(pos, offset), ' '];
    }, function() {
      return ['Q '];
    }
  ];
  next = function() {
    console.log("next");
    var x, _i, _len, _ref;
    if (state < states.length) {
      _ref = states[state++]();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        x = _ref[_i];
        serial.write(x);
      }
      serial.flush(function(){});
      reply = '';
      return timer = setTimeout((function() {
        return done(state);
      }), 30000);
    } else {
      return done();
    }
  };
  serial.on('open', next);
  serial.on('error', done);
  
  serial.on('data', function(data) {
    reply += data;
    console.log("got serial data", reply);
    if (reply.slice(-2) === '\x14\x10') {
      console.log("gna");
      clearTimeout(timer);
      return next();
    }
  });
  serial.open();
};

/*avrUploader(hexToBin(hex), '/dev/ttyACM0', function(err) {
  if (err) {
    console.error('err', err);
  }
  return console.log(hexToBin(hex).length);
});*/

module.exports = avrUploader;
