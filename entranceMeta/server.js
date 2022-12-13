const app = require('express')();
const http = require('http');
const server = http.Server(app);
const io = require('socket.io')(server, {
 cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
});
const mdbConn = require('../db/mariaDBConn.js');


// get 요청
app.get('/', (req, res) => {

  console.log('user');

      res.send("승열님")


});


// 클라이언트 접속 이벤트
io.on('connection', (socket) => {
  console.log('a user connected');


  socket.on('joinMeta', (jsonData) => {
    var jwt = atob(jsonData);  // 토큰 base64 decode
    var jwtArr = jwt.split('.'); // payload 파싱
    var payload = JSON.parse(jwtArr[1]); // json으로 변환

    // json에서 값 파싱 및 decode
    var user_id = atob(payload.User_ID);
    console.log('User_ID: '+user_id);

    // db에서 클라이언트 id로 사용자 정보(이름, email) 조회
    mdbConn.getUserData(user_id)
    .then((rows) => {
      // var jsonObject = JSON.parse(rows);
      console.log("email: "+rows.U_Email);
      console.log("name: "+rows.U_Name);
      socket.emit('succMeta', user_id);

    })
    .catch((errMsg) => {
      socketa.emit('errorMsg', errMsg);
      console.log("err: "+errMsg);
    });

  });



  socket.on('movedUser', (x, y, d) => {
        console.log("캐릭터이동: "+x+y+d);
        socket.emit('movedUser', x, y, d);
  });


  socket.on('disconnect', async () => {
        socket.emit('exitUser', user_id)
        console.log('user disconnected');
  });

});

server.listen(8080, () => {
  console.log('Connected at 8080');
});

