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

/// 예제1
app.get('/exam', (req, res) => {

  res.sendFile(__dirname + '/index.html');

});
// 예제1 끝



// 클라이언트 접속 이벤트
io.on('connection', (socket) => {
  console.log('a user connected');
  var jwt;

  socket.on('joinMeta', (jsonData) => {
    
    try {
      jwt = atob(jsonData);  // 토큰 base64 decode
      console.log('토큰 확인');
    } catch(e) {
      console.log('잘못된 토큰');
      socket.emit('joinMetaErr', e);
      jwt = "";
    }
    

    if(jwt != ""){ // 토큰 확인
      var jwtArr = jwt.split('.'); // payload 파싱
      var payload;
    }

    
    try {
      payload = JSON.parse(jwtArr[1]); // json으로 변환
    } catch(e) {
      console.log('잘못된 토큰');
      socket.emit('joinMetaErr', e);
      payload = "";
    }
    
    
    if(payload != ""){ // json 파싱 확인
      
      // json에서 값 파싱 및 decode
      var user_id = atob(payload.User_ID);
      console.log('User_ID: '+user_id);

      // db에서 클라이언트 id로 사용자 정보(이름, email) 조회
      mdbConn.getUserData(user_id)
      .then((rows) => {
        // var jsonObject = JSON.parse(rows);
        socket.emit('succMeta', user_id);

      })
      .catch((errMsg) => {
        socketa.emit('errorMsg', errMsg);
        console.log("err: "+errMsg);
      });

      socket.on('movedUser', (x, y, d) => {
        console.log("캐릭터이동: "+x+y+d);
        socket.emit('movedUser', x, y, d);
      });
    
      socket.on('disconnect', async () => {
            socket.emit('exitUser', user_id)
            console.log('user disconnected');
      });  

    }
    
  });



});

server.listen(8080, () => {
  console.log('Connected at 8080');
});

