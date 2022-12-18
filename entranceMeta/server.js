const player = require('./player.js');
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


  // 공용 메타버스 소켓list 객체
  let Square = {};
  let cnt = 0;
  
  // 클라이언트 접속
  io.on('connection', (socket) => {
    console.log('a user connected');
    let player1;
    cnt++;

    socket.nickname = getNickname();
  
    // 새로운 클라이언트 입장 이벤트-수신
    socket.on('NEW_PLAYER', (room, position) => {

      // userId 확인을 위한 이벤트 - 발신
      socket.emit("userId", socket.id);
  
      // 클라이언트 객체(식별자, x, y, direction)
      player1 = new  player(socket.id, position.x, position.y, position.direction);
      console.log('room: '+room);
      console.log('x: '+position.x);
      console.log('y: '+position.y);
      console.log('direction: '+position.direction);
      console.log("id: "+ socket.id);
  
      // room에 클라이언트 추가
      // room 단위로 클라이언트를 구분하기 위함
      socket.join(room);

      // 소켓이 추가된 room 정보(확인해야함)
      socket.room = room;

      //Square 객체에 socket.id라는 key에 player1(클라이언트 정보)를 저장
      Square[socket.id] = player1;
      console.log('x: '+player1.x);
      console.log('y: '+player1.y);
      console.log('direction: '+player1.direction);
  
      // 현재 공용 메타버스에 참여중인 클라이언트 목록
      // 클라이언트 입장시 현재 참여중인 클라언트 정보를 제공하기 위함
      let players = [];
  
      // Square가 크기만큼 반복
       for (let i in Square) {
         players.push(Square[i]);
         console.log("값: "+ Square[socket.id].x);
       }
  
  
       console.log('players:'+ players);
  
       // 전체 사용자 목록 제공 이벤트 - 발신
       socket.emit('ALL_PLAYERS', players);
  
      // 사용자 입장 이벤트 - 발신
      // room에 참여중인 클라이언트 중 방금 입장한 클라이언트 외의 다른 클라이언트들에게 이벤트 발신
      socket.broadcast.to(room).emit('NEW_PLAYER', player1);

      
  });

  // 방향키 입력 이벤트
  // coor = x, y값
  socket.on("KEY_PRESS", (direction, coor) => {
      // player.update(direction, coor);
      console.log("direction: "+ direction);
      console.log("x: "+ coor.x);
      console.log("y: "+ coor.y);
      
      // 입력받은 클라이언트 정보로 기존 클라이언트 정보 변경
      player1 = update(player1, direction, coor);

      // 변경된 클라이언트 정보를 room에 있는 자신 외의 다른 클라이언트에게 이벤트 - 발신
      socket.broadcast.to(socket.room).emit("MOVE", player1);
  });


  // 클라이언트 이동 멈춤 이벤트 - 수신
  socket.on("STOP", (coor) => {
    // 입력받은 위치 정보로 클라이언트 정보 변경
    player1 = updatePosition(player1, coor);

    // 변경된 클라이언트 정보를 room에 있는 자신 외의 다른 클라이언트에게 이벤트 - 발신
    socket.broadcast.to(socket.room).emit("STOP", player1);
  });

  socket.on()("CHAT", (msg) => {
    // : 이벤트명, nickname, msg
    socket.broadcast.to(socket.room).emit("CHAT", msg, socket.nickname);
  })


  // 클라이언트 퇴장 이벤트
  socket.on("disconnect", () => {
    // Square[socket.id];
    
    // Square 객체의 socket.id를 key로 갖는 값 삭제
    // Square라는 room에서 해당 클라이언트 삭제
    delete Square[socket.id];
    console.log(socket.id+": 퇴장했습니다.");

    // 룸에서 제거
    io.leave(socket.room);

    // 클라이언트 퇴장 이벤트 - 발신 
    io.to(socket.room).emit("REMOVE", socket.id);
  });




});

  // 클라이언트 위치 변경 메소드  
  // 클라이언트 정보와 변경된 위치 값을 받아 클라이언트 정보 변경 후 리턴
  function updatePosition(player1, coor){
    player1.x = coor.x;
    player1.y = coor.y;
    return player1;
  }

  // 클라이언트 이동 변경 메소드
  // 클라이언트 정보와 방향, 변경된 위치값을 받아 클라이언트 정보 변경 후 리턴
  function update(player1, direction, coor) {

    player1.direction = direction;
    player1.x = coor.x;
    player1.y = coor.y;
    return player1;

  };

  function getNickname(){
    return "user_"+cnt;
  }


// 8080port로 클라이언트 접근 대기
server.listen(8080, () => {
  console.log('Connected at 8080');
});