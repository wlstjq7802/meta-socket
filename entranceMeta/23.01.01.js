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
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/chatRoom.html');
});



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
                console.log("jwt: "+jwt);

                let user_data = jwtUtil.decodeJWT(jwt);
                let user_id = user_data.user_id;
                socket.user_name = user_data.user_name;

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


// 1. chat_room_id 확인
if(chat_room_id == null){

        // 1-1.chat_room_id 조회
        mdbConn.getChatRoomId(sender_id, receiver_id)
                .then((resultObj) => {
                        if(resultObj.result == 101 || resultObj.result == 102){
                                chatRoomId = parseInt(resultObj.chat_room_id, 10);

                                console.log("채팅방_id 조회: "+chatRoomId);


                                if(resultObj.result == 102){
                                        // 채팅방이 생성된 경우 발신자, 수신자를 Room에 추가
                                        socket.join(chatRoomId);

                                        // 수신자 socket 확인하여 Room에 join

                                        getSocketListInNamspace("/webChatting")
                                        .then((socket_list) => {
                                                for(socketIndex in socket_list){
                                                        console.log(`socket.user_id: ${socket_list[socketIndex].user_id}   receiver_id: ${receiver_id} 입니다.`);
                                                        if(socket_list[socketIndex].user_id == receiver_id){
                                                                socket_list[socketIndex].join(chatRoomId);
                                                                console.log(`${socket_list[socketIndex].user_id}를 ${chatRoomId}에 추>가하였습니다.`);
                                                                break;
                                                        }
                                                }
                                        })
                                        .catch((errMsg) => {
                                                console.log(errMsg);
                                        });
                        }



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
                                          webChatting.to(chatRoomId).emit('receive_text_msg', chatRoomId, chat_msg, sender_id, 
                                          resultObj.name, resultObj.user_img, resultObj.msg_date);

                                          console.log("메시지 전송 함1");
                                  } else{
                                          console.log("메시지 전송 안함 1");
                                          // 3-2.발신자에게 발신 실패 메시지 발신

                                  }
                          }).catch((errMsg) => {
                                  console.log(errMsg);

                                });

                              } else{
                                      console.log("채팅방 조회 결과: 에러~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
                              }

                      }).catch((errMsg) => {
                              console.log(errMsg);
                      });

      } else{
              chatRoomId = parseInt(chat_room_id, 10);

              // 메시지 저장
              mdbConn.saveMsg(chatRoomId, chat_msg, sender_id, "text", 0)
                      .then((resultObj) => {

                              console.log("메시지 발신 이벤트 수신 결과2: "+ resultObj);

                              // 3.메시지 저장 확인
                              if(resultObj.result == 0){
                                      console.log("메시지 저장완료하여 메시지 전송");
                                      // 3-1.해당 채팅방의 모든 user에게 메시지 발신
                                      // chat_room_id, chat_msg, sender_id,   sender_name, sender_img, msg_date

                                      webChatting.to(chatRoomId).emit('receive_text_msg', chatRoomId, chat_msg, 
                                      sender_id, resultObj.name, resultObj.user_img, resultObj.msg_date);
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
                                                                                                        teacher_img, paypal_link, msg_date, student_id, teacher_id, msg_id);

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
                        socket.user_name, teacher_img, msg_date, student_id, teacher_id, msg_id);
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
  socket.on('cancel_class', (student_id, teacher_id, class_id, class_register_id, chat_msg) => {
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



  // 메시지 읽음 이벤트
socket.on('read_msg', (chat_room_id, sender_id) => {
  console.log(`MSG 읽음 이벤트 ------------------------------------`);
console.log(`chat_room_id: `+chat_room_id);
  console.log(`sender_id: `+sender_id);
  mdbConn.senderCheck(chat_room_id, sender_id)
  .then((result) => {
      // 3.메시지 저장 확인
      console.log("sender 확인 결과: "+ result.result);

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
    console.log(socket.user_id+"님이 퇴장합니다.---------------------------")
});


});
// 웹 채팅 - 끝


  // 8080port로 클라이언트 접근 대기
  server.listen(8080, () => {
    console.log('Connected at 8080');
  })

