const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mdbConn = require('../db/mariaDBConn.js');

var token;
app.get('/', (req, res) => {
    // token = req.query.token;
    res.sendFile(__dirname + '/index.html');
});


io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('joinMetaverse', (jsonData) => {
    var jwt = atob(jsonData);  // 토큰 base64 decode
    var jwtArr = jwt.split('.'); // payload 파싱
    var payload = JSON.parse(jwtArr[1]); // json으로 변환

    // json에서 값 파싱 및 decode
    var user_id = atob(payload.User_ID);
    var user_name = atob(payload.U_Name);
    var user_email = atob(payload.U_Email);

    console.log('User_ID: '+user_id);
    // console.log('U_Name: '+user_name);
    // console.log('U_Email: '+user_email);
    // console.log('payload: '+payload["alg"]);

    // db에서 클라이언트 id로 사용자 정보(이름, email) 조회
    mdbConn.getUserList(user_id)
    .then((rows) => {
      // var jsonObject = JSON.parse(rows);
      console.log("email: "+rows.U_Email);
      console.log("name: "+rows.U_Name);
      io.emit('userData', rows.U_Name, rows.U_Email);
    })
    .catch((errMsg) => {
      console.log("err: "+errMsg);
    });

    // 클라이언트로 userData 전송
    


  });
  
  

});

http.listen(8080, () => {
  console.log('Connected at 3000');
});





