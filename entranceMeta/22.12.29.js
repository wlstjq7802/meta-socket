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
const webChatUtil = require('../db/webChat.js');
const jwtUtil = require('../util/jwt.js');


  // 공용 메타버스 소켓list 객체
  let Square = {};
  let Study = {};
  let cnt = 0;

// 네임스페이스 구분
const webChatting = io.of('/webChatting'); // WebChatting
const HS = io.of('/HS'); // 공용 메타버스
const ST = io.of('/STUDY'); // 수업 메타버스




// 라우터 
// app.get('/', (req, res) => {
//   res.sendFile(__dirname + '/chatRoom.html');
// });






// 웹 채팅 - 시작
webChatting.on('connection', (socket)=>{



  console.log("webChatting에 클라이언트 입장");


// 채팅방 입장 이벤트
socket.on('enter_chat_room', (chat_room_id, user_id) => {
  console.log(`채팅방 입장 ------------------------------------`);
  chat_room_id = parseInt(chat_room_id, 10);
  user_id = parseInt(user_id, 10);
  console.log("enter_chat_room 이벤트 - chat_room_id: "+ chat_room_id+ " user_id: "+user_id);

  // 1. 채팅방의 recent_msg_id 확인
  mdbConn.enterUpdateLastCheck(chat_room_id, user_id)
  .then((resultObj) => {
    if(resultObj.result == 0){
      console.log("채팅방 입장 이벤트 업데이트 성공");
    } else{
      console.log("채팅방 입장 이벤트 업데이트 실패~~");
    }

  })
  .catch((errMsg) => {
    console.log("채팅방 입장 이벤트 업데이트 에러: "+errMsg);
  });
  

});



// 사용자 메타버스 입장 수신
socket.on('enter_web_chat', (jwt) => {
    // console.log(`${jwt}님이 입장하였습니다.`);
    console.log(`web 채팅 입장 ------------------------------------`);
    let user_id = jwtUtil.decodeJWT(jwt);

    if(user_id != -1){
      console.log(`복호화환 user_id: ${user_id}`);
      socket.user_id = user_id;

      // 1.사용자 채팅방 목록 조회
      webChatUtil.getJoinChatRoomList(user_id)
      .then((resultArr) => {
        
        // 2.조회된 채팅방에 소켓 연결
        for(let i=0; i<resultArr.length; i++){
          console.log(`참여중인 채팅방_id: ${resultArr[i]}`);
          let chat_room = parseInt(resultArr[i], 10);
          socket.join(chat_room);
        }
      

        // 3.클라이언트로 응답
        socket.emit("enter_web_chat", "success");

      })
      .catch((errMsg) => {
        socket.emit("enter_web_chat", "fail");
        console.log(errMsg);
      });

    }

});



// 메시지 발신 이벤트 수신
socket.on('send_text_msg', (chat_room_id, chat_msg, sender_id, receiver_id) => {
  /*
    1. chat_room_id 확인

      @ chat_room_id가 null인 경우
      1-1. sender_id와 receiver_id로 chat_room_id 조회
    
        @ 채팅방이 있는 경우
        1-2. chat_room_id 리턴

        @ 채팅방이 없는 경우
        1-2. 채티방 생성 후 chat_room_id 리턴
    
  */
  
  console.log("채팅 발신 ------------------------------------------");  
  console.log(`${chat_room_id} - ${sender_id}: ${chat_msg}`);
  let chatRoomId;
  chatRoomId = parseInt(chat_room_id, 10);

    // 1. chat_room_id 확인
    if(chatRoomId == null){

      // 1-1.chat_room_id 조회
      mdbConn.getChatRoomId(sender_id, receiver_id)
      .then((resultObj) => {
        if(resultObj.result == 101 || resultObj.result == 102){
          const chat_room_id = parseInt(resultObj.chat_room_id, 10);
        } else{
          console.log("채팅방 조회 결과: 에러~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
        }

      }).catch((errMsg) => {
          console.log(errMsg);
      });


        // 1.채팅방 생성 - return값 chat_room_id
        mdbConn.createChatRoom(sender_id, receiver_id)
        .then((rows) => {
          console.log("채팅방 요청 결과: "+rows);
          chatRoomId = parseInt(rows.chat_room_id, 10);

          // 채팅방이 생성된 경우 발신자, 수신자를 Room에 추가
          socket.join(chatRoomId);

          // 수신자 socket 확인하여 Room에 join
          getSocketListInNamspace("/webChatting")
          .then((socket_list) => {
            for(socketIndex in socket_list){
              console.log(`socket.user_id: ${socket_list[socketIndex].user_id}   receiver_id: ${receiver_id} 입니다.`);
              if(socket_list[socketIndex].user_id == receiver_id){
                socket_list[socketIndex].join(chatRoomId);
                console.log(`${socket_list[socketIndex].user_id}를 ${chatRoomId}에 추가하였습니다.`);
                break;
              }
            }
          })
          .catch((errMsg) => {
              console.log(errMsg);
          });
          

          // 2.메시지 저장
          mdbConn.saveMsg(chatRoomId, chat_msg, sender_id, "text", 0)
          .then((resultObj) => {

            console.log("메시지 발신 이벤트 수신 결과1: "+ resultObj.result);

            // 3.메시지 저장 확인
            if(resultObj.result == 0){
              console.log("메시지 저장완료하여 메시지 전송");
              console.log("chatRoomID: "+ chatRoomId);
              console.log("chat_msg: "+ chat_msg);
              console.log("sender_id: "+ sender_id);
              

              // 3-1 상대방을 해당 채팅방에 join

              // 3-2.해당 채팅방의 모든 user에게 메시지 발신
              webChatting.to(chatRoomId).emit('receive_text_msg', chatRoomId, chat_msg, sender_id, resultObj.name, resultObj.user_img, resultObj.msg_date);
              
              console.log("메시지 전송 함1");
            } else{
              console.log("메시지 전송 안함 1");
              // 3-2.발신자에게 발신 실패 메시지 발신
              
            }
          });
        })
        .catch((errMsg) => {
          console.log(errMsg);
        });

    } else{

      // 메시지 저장
      mdbConn.saveMsg(chatRoomId, chat_msg, sender_id, "text", 0)
      .then((resultObj) => {

        console.log("메시지 발신 이벤트 수신 결과2: "+ resultObj);

        // 3.메시지 저장 확인
        if(resultObj.result == 0){
          console.log("메시지 저장완료하여 메시지 전송");
          // 3-1.해당 채팅방의 모든 user에게 메시지 발신
          // chat_room_id, chat_msg, sender_id,   sender_name, sender_img, msg_date
          webChatting.to(chatRoomId).emit('receive_text_msg', chatRoomId, chat_msg, sender_id, resultObj.name, resultObj.user_img, resultObj.msg_date);
        } else{
          console.log("메시지 전송 안함 2");
          // 3-2.발신자에게 발신 실패 메시지 발신
          
        }
      })
      .catch((errMsg) => {
        console.log(errMsg);
      });
    }
});





// paypal 이벤트 수신
socket.on('send_paypal_msg', (student_id, teacher_id, class_id, class_register_id, chat_msg) => {
    console.log(`paypal링크 발신--------------------`);

        // 채팅룸_id 조회
        mdbConn.getChatRoomId(student_id, teacher_id)
        .then((chatRoomObj) => {
          if(chatRoomObj.result == 101){
            console.log(`chat_room_id: ${chatRoomObj.chat_room_id}`);


            // 강사명, img, payment_link 조회
            mdbConn.getTeacherData(teacher_id)
            .then((teacherDataObj) => {
              
              if(teacherDataObj.result == 101){
                console.log(`linkArr: ${teacherDataObj.linkArr}`);
                console.log(`name: ${teacherDataObj.name}`);
                console.log(`user_img: ${teacherDataObj.user_img}`);

                // 클래스명 조회
                mdbConn.getClassName(class_id)
                .then((classNameObj) => {
                  console.log(`class_name: ${classNameObj.class_name}`);
                  if(classNameObj.result == 101){
                    console.log("paypal조회 끝");

                    const chat_room_id = parseInt(chatRoomObj.chat_room_id, 10);                    

                    // 메시지 저장
                    mdbConn.saveMsg(chat_room_id, chat_msg, teacher_id, "payment_link", class_register_id)
                    .then((resultObj) => {
                      if(resultObj.result == 0){
                        const class_name = classNameObj.class_name;
                        const teacher_name = teacherDataObj.name;
                        const teacher_img = teacherDataObj.user_img;
                        const paypal_link = teacherDataObj.linkArr;
                        const msg_date = resultObj.msg_date;
                        const msg_id = parseInt(resultObj.msg_id, 10);
                        class_register_id = parseInt(class_register_id, 10);

                        // paypal msg 발신
                        // 필요한 데이터
                        // chat_room_id, class_register_id, class_name,
                        // teacher_name, teacher_img, paypal_link(array), msg_date
                        // emit("receive_paypal_msg", );
                        webChatting.to(chat_room_id)
                        .emit('receive_paypal_msg', chat_room_id, class_register_id, class_name, teacher_name, 
                        teacher_img, paypal_link, msg_date, teacher_id, msg_id);
                      }
                      
                    }).catch((errMsg) => {
                      console.log(errMsg);
                    });// saveMsg


                } else{
                  console.log("paypal조회 실패");
                }
              })
              .catch((errMsg) => {
                console.log(errMsg);
              });// getClassName
          } else{
            
          }
        })
        .catch((errMsg) => {
          console.log(errMsg);
        });// getTeacherData

      } else{
        
      }
    })
    .catch((errMsg) => {
      console.log(errMsg);
    }); // getChatRoomId

});



// 수강 신청 이벤트 수신
socket.on('request_class', (student_id, teacher_id, class_id, class_register_id, chat_msg) => {
  console.log(`수강 신청------------------------------------`);
  console.log(`student_id: ${student_id}`);
  console.log(`teacher_id: ${teacher_id}`);
  console.log(`class_id: ${class_id}`);
  console.log(`class_register_id: ${class_register_id}`);


  // 채팅룸_id 조회
  mdbConn.getChatRoomId(student_id, teacher_id)
  .then((chatRoomObj) => {
    if(chatRoomObj.result == 101 || chatRoomObj.result == 102){
      console.log(`chat_room_id: ${chatRoomObj.chat_room_id}`);

      // 채팅방이 생성된 경우 발신자, 수신자를 Room에 추가
      if(chatRoomObj.result == 102){
          let chatRoomId = parseInt(chatRoomObj.chat_room_id, 10);

          // 채팅방이 생성된 경우 발신자, 수신자를 Room에 추가
          socket.join(chatRoomId);

          // 수신자 socket 확인하여 Room에 join
          getSocketListInNamspace("/webChatting")
          .then((socket_list) => {
            for(socketIndex in socket_list){
              console.log(`socket.user_id: ${socket_list[socketIndex].user_id}   receiver_id: ${teacher_id} 입니다.`);
              if(socket_list[socketIndex].user_id == teacher_id){
                socket_list[socketIndex].join(chatRoomId);
                console.log(`${socket_list[socketIndex].user_id}를 ${chatRoomId}에 추가하였습니다.`);
                break;
              }
            }
          })
          .catch((errMsg) => {
              console.log(errMsg);
          });
      }


          // 강사명, img, 조회
          mdbConn.getUserData(teacher_id)
          .then((userDataObj) => {
            
            if(userDataObj.result == 101){
              
              console.log(`name: ${userDataObj.name}`);
              console.log(`user_img: ${userDataObj.user_img}`);


                // 클래스명 조회
                mdbConn.getClassName(class_id)
                .then((classNameObj) => {
                  console.log(`class_name: ${classNameObj.class_name}`);
                  if(classNameObj.result == 101){
                    console.log("수강 요청 조회 끝");

                    const chat_room_id = parseInt(chatRoomObj.chat_room_id, 10);                    

                    // 메시지 저장
                    mdbConn.saveMsg(chat_room_id, chat_msg, student_id, "request_class", class_register_id)
                    .then((resultObj) => {
                      if(resultObj.result == 0){
                        const class_name = classNameObj.class_name;
                        const teacher_name = userDataObj.name;
                        const teacher_img = userDataObj.user_img;
                        const msg_date = resultObj.msg_date;
                        const msg_id = parseInt(resultObj.msg_id, 10);
                        class_register_id = parseInt(class_register_id, 10);

                        // 수강 신청 msg 발신
                        // 필요한 데이터
                        // chat_room_id, class_register_id, class_name, 
                        // teacher_name, teacher_img, msg_date
                        webChatting.to(chat_room_id)
                        .emit('request_class', chat_room_id, class_register_id, class_name, 
                        teacher_name, teacher_img, msg_date, student_id, teacher_id, msg_id);
                      }
                      
                    }).catch((errMsg) => {
                      console.log(errMsg);
                    });


                  } else{
                    console.log("수강 요청 조회 실패");
                  }
                })
                .catch((errMsg) => {
                  console.log(errMsg);
                });
        } else{
          
        }
      })
      .catch((errMsg) => {
        console.log(errMsg);
      });

    } else{
      
    }
  })
  .catch((errMsg) => {
    console.log(errMsg);
  });

  


});



  // 수강 승인 이벤트 수신
  socket.on('acceptance_class', (student_id, teacher_id, class_id, class_register_id, chat_msg) => {
    console.log(`수강 승인------------------------------------`);
    console.log(`student_id: ${student_id}`);
    console.log(`teacher_id: ${teacher_id}`);
    console.log(`class_id: ${class_id}`);
    console.log(`class_register_id: ${class_register_id}`);

    // 강사명, img, payment_link 조회
    mdbConn.getUserData(teacher_id)
    .then((userDataObj) => {
      
      if(userDataObj.result == 101){
        
        console.log(`name: ${userDataObj.name}`);
        console.log(`user_img: ${userDataObj.user_img}`);
        
        // 채팅룸_id 조회
        mdbConn.getChatRoomId(student_id, teacher_id)
        .then((chatRoomObj) => {
          if(chatRoomObj.result == 101){
            console.log(`chat_room_id: ${chatRoomObj.chat_room_id}`);

              // 클래스명 조회
              mdbConn.getClassName(class_id)
              .then((classNameObj) => {
                console.log(`class_name: ${classNameObj.class_name}`);
                if(classNameObj.result == 101){
                  console.log("수강 승인 조회 끝");

                  const chat_room_id = chatRoomObj.chat_room_id;                    

                  // 메시지 저장
                  mdbConn.saveMsg(chat_room_id, chat_msg, teacher_id, "acceptance_class", class_register_id)
                  .then((resultObj) => {
                    if(resultObj.result == 0){
                      const class_name = classNameObj.class_name;
                      const teacher_name = userDataObj.name;
                      const teacher_img = userDataObj.user_img;
                      const msg_date = resultObj.msg_date;
                      const msg_id = parseInt(resultObj.msg_id, 10);
                      class_register_id = parseInt(class_register_id, 10);

                      // 수강 신청 msg 발신
                      // 필요한 데이터
                      // chat_room_id, class_register_id, class_name, 
                      // teacher_name, teacher_img, msg_date, teacher_id

                      webChatting.to(chat_room_id)
                      .emit('acceptance_class', chat_room_id, class_register_id, class_name, 
                      teacher_name, teacher_img, msg_date, student_id, teacher_id, msg_id);
                    }
                    
                  }).catch((errMsg) => {
                    console.log(errMsg);
                  });


                } else{
                  console.log("수강 승인 조회 실패");
                }
              })
              .catch((errMsg) => {
                console.log(errMsg);
              });
          } else{
            
          }
        })
        .catch((errMsg) => {
          console.log(errMsg);
        });

      } else{
        
      }
    })
    .catch((errMsg) => {
      console.log(errMsg);
    });

    
  });



  // 수강 취소 이벤트 수신
  socket.on('cancel_class', (student_id, teacher_id, class_id, class_register_id, sender_id, chat_msg) => {
    console.log(`수강 취소------------------------------------`);
    console.log(`student_id: ${student_id}`);
    console.log(`teacher_id: ${teacher_id}`);
    console.log(`class_id: ${class_id}`);
    console.log(`class_register_id: ${class_register_id}`);


      // 강사명, img, payment_link 조회
      mdbConn.getUserData(teacher_id)
      .then((userDataObj) => {
        
        if(userDataObj.result == 101){
          
          console.log(`name: ${userDataObj.name}`);
          console.log(`user_img: ${userDataObj.user_img}`);
          
          // 채팅룸_id 조회
          mdbConn.getChatRoomId(student_id, teacher_id)
          .then((chatRoomObj) => {
            if(chatRoomObj.result == 101){
              console.log(`chat_room_id: ${chatRoomObj.chat_room_id}`);

                // 클래스명 조회
                mdbConn.getClassName(class_id)
                .then((classNameObj) => {
                  console.log(`class_name: ${classNameObj.class_name}`);
                  if(classNameObj.result == 101){
                    console.log("수강 승인 조회 끝");

                    const chat_room_id = chatRoomObj.chat_room_id;                    

                    // 메시지 저장
                    mdbConn.saveMsg(chat_room_id, chat_msg, teacher_id, "cancel_class", class_register_id)
                    .then((resultObj) => {
                      if(resultObj.result == 0){
                        const class_name = classNameObj.class_name;
                        const teacher_name = userDataObj.name;
                        const teacher_img = userDataObj.user_img;
                        const msg_date = resultObj.msg_date;
                        const msg_id = parseInt(resultObj.msg_id, 10);
                        class_register_id = parseInt(class_register_id, 10);

                        // 수강 신청 msg 발신
                        // 필요한 데이터
                        // 필요한 데이터
                        // chat_room_id, class_register_id, class_name, 
                        // teacher_name, teacher_img, msg_date teacher_id

                        webChatting.to(chat_room_id)
                        .emit('cancel_class', chat_room_id, class_register_id, class_name, 
                        teacher_name, teacher_img, msg_date, sender_id, msg_id);
                      }
                      
                    }).catch((errMsg) => {
                      console.log(errMsg);
                    });


                  } else{
                    console.log("수강 승인 조회 실패");
                  }
                })
                .catch((errMsg) => {
                  console.log(errMsg);
                });
            } else{
              
            }
          })
          .catch((errMsg) => {
            console.log(errMsg);
          });

        } else{
          
        }
      })
      .catch((errMsg) => {
        console.log(errMsg);
      });

  });



  // 메시지 읽음 이벤트
socket.on('read_msg', (chat_room_id, sender_id) => {
  console.log(`MSG 읽음 이벤트 ------------------------------------`);
    mdbConn.senderCheck(chat_room_id, sender_id)
    .then((result) => {
        // 3.메시지 저장 확인
        console.log("sender 확인 결과: "+ result);

        mdbConn.updateLastCheck(chat_room_id, result)
        .then((result) => {
          if(result == 0){
            console.log("last_check 업데이트 완료 ");
            webChatting.to(chat_room_id)
            .emit('read_msg_check', chat_room_id, sender_id);
          } else{
            console.log("last_check 업데이트 실패");
          }
        })
        .catch((errMsg) => {
          console.log(errMsg);
        });
    })
    .catch((errMsg) => {
      console.log(errMsg);
    });
});


  socket.on('disconnect', async () => {
      console.log(socket.user_id+"님이 퇴장합니다.")
      for(let i=0; i < userJoinChatRoom.length; i++){

        console.log("채팅방 퇴장: "+userJoinChatRoom[i]);
        socket.leave(userJoinChatRoom[i]);
      }
      console.log('user disconnected');
  });


});
// 웹 채팅 - 끝








 // 공용 메타버스
   // 클라이언트 접속
   HS.on('connection', (socket) => {
    console.log('HS a user connected');
    let player1;
    cnt++;


    socket.nickname = getNickname();

    // 새로운 클라이언트 입장 이벤트-수신
    socket.on('NEW_PLAYER', (room, position) => {

      // userId 확인을 위한 이벤트 - 발신
      socket.emit("userId", socket.id, socket.nickname);

      // 클라이언트 객체(식별자, x, y, direction)
      player1 = new  player(socket.id, position.x, position.y, position.direction, socket.nickname);

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
      if(Square[socket.room] == null){
        Square[socket.room] = {};
        Square[socket.room][socket.id] = player1;
        console.log("room 생성 사용자입장: "+socket.id);
      } else{
        Square[socket.room][socket.id] = player1;
        console.log("room 있음 사용자입장: "+socket.id);
      }
      // console.log('x: '+player1.x);
      // console.log('y: '+player1.y);
      // console.log('direction: '+player1.direction);

      // 현재 공용 메타버스에 참여중인 클라이언트 목록
      // 클라이언트 입장시 현재 참여중인 클라언트 정보를 제공하기 위함
      let players = [];

            // Square가 크기만큼 반복
            for (let i in Square[room]) {
                players.push(Square[room][i]);
               //  console.log("값: "+ Square[room][socket.id].x);
              }
       
       
              console.log('players:'+ players.length);
       
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
       
           socket.on("CHAT", (msg) => {
             console.log(socket.nickname+": "+msg);
             // : 이벤트명, nickname, msg
             socket.broadcast.to(socket.room).emit("CHAT", msg, socket.nickname);
            })


            // 귓속말
           socket.on("WHISPER", (msg, receiver) => {
              console.log(socket.nickname+" =>  "+receiver+": "+msg);
       
              socket.to(receiver).emit("WHISPER", msg, socket.nickname);
              // io.sockets.socket(receiver).emit('WHISPER', msg, socket.nickname);
           });
       
       
       
           // 클라이언트 퇴장 이벤트
           socket.on("disconnect", () => {
             // Square[socket.id];
       
             // Square 객체의 socket.id를 key로 갖는 값 삭제
             // Square라는 room에서 해당 클라이언트 삭제
       
             console.log(socket.id+": 퇴장했습니다. - HS");
            delete Square[socket.room][socket.id];
            
      // 룸에서 제거
      socket.leave(socket.room);
      // 클라이언트 퇴장 이벤트 - 발신 
  socket.to(socket.room).emit("REMOVE", socket.id, socket.nickname);
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
    console.log('클라이언트 닉네임 부여: user'+ cnt);
    return "user_"+cnt;
  }


});
// 공용 메타버스 - 끝



async function getSocketListInNamspace(namespace){
    let result; 

    try{
      result = await io.of(namespace).fetchSockets();

      console.log(`현재 클라이언트: ${Object.values(result).length}명입니다.`);
      
    } catch(err){
        console.log(err);
        result = -1;
        console.log("소켓 개수 확인 실패");
    }
    finally{
        return result;
    }
}




// 수업 메타버스
 // 클라이언트 접속
 ST.on('connection', (socket) => {
  console.log('STUDY a user connected');
  let player1;
  cnt++;

  socket.nickname = getNickname();

    // 새로운 클라이언트 입장 이벤트-수신
    socket.on('NEW_PLAYER', (room, position) => {

        // userId 확인을 위한 이벤트 - 발신
        socket.emit("userId", socket.id, socket.nickname);
    
        // 클라이언트 객체(식별자, x, y, direction)
        player1 = new  player(socket.id, position.x, position.y, position.direction, socket.nickname);
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
          if(Study[socket.room] == null){

            Study[socket.room] = {};
            Study[socket.room][socket.id] = player1;
            console.log("room 생성 사용자입장: "+socket.id);
          } else{
            Study[socket.room][socket.id] = player1;
            console.log("room 있음 사용자입장: "+socket.id);
          }
    
    
        // 현재 공용 메타버스에 참여중인 클라이언트 목록
        // 클라이언트 입장시 현재 참여중인 클라언트 정보를 제공하기 위함
        let players = [];
    
        // Square가 크기만큼 반복
         for (let i in Study[socket.room]) {
           players.push(Study[socket.room][i]);
           //console.log("값: "+ Study[socket.id]);
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

  socket.on("CHAT", (msg) => {
    console.log(socket.nickname+": "+msg);
    // : 이벤트명, nickname, msg
    socket.broadcast.to(socket.room).emit("CHAT", msg, socket.nickname);
  })



  // 귓속말
  socket.on("WHISPER", (msg, receiver) => {
    console.log(socket.nickname+" =>  "+receiver+": "+msg);

    socket.to(receiver).emit("WHISPER", msg, socket.nickname);
    // io.sockets.socket(receiver).emit('WHISPER', msg, socket.nickname);
  });

    // 클라이언트 퇴장 이벤트
    socket.on("disconnect", () => {
        // Square[socket.id];
    
        // Square 객체의 socket.id를 key로 갖는 값 삭제
        // Square라는 room에서 해당 클라이언트 삭제
        delete Study[socket.room][socket.id];
        console.log(socket.id+": 퇴장했습니다.- STUDY");
    
        // 룸에서 제거
        socket.leave(socket.room);
            // 클라이언트 퇴장 이벤트 - 발신 
        socket.to(socket.room).emit("REMOVE", socket.id, socket.nickname);
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
    console.log('클라이언트 닉네임 부여: user'+ cnt);
    return "user_"+cnt;
  }
  
  
  });
  
  // 수업 메타버스 - 끝
  




  
  // 8080port로 클라이언트 접근 대기
  server.listen(8080, () => {
    console.log('Connected at 8080');
  })

  