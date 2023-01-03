const mariadb = require('mariadb');
const vals = require('../consts.js');

const pool = mariadb.createPool({
    host: vals.DBHost, port:vals.DBPort,
    user: vals.DBUser, password: vals.DBPass,
    connectionLimit: 30
});

// 채팅방 생성
/*
    채팅방 생성 후 해당 채팅방 id 리턴
*/

async function CreateChatRoom(sender_id, receiver_id){
    let conn, rows, errorChk = true;
    let currentTime = getNowTimestamp();

    try{
        conn = await pool.getConnection();
        conn.query('USE HANGLE');
        rows = await conn.query(`INSERT INTO Chat_Room (chat_room_date, chat_room_name, chat_room_type, sender_id, receiver_id, sender_last_check, receiver_last_check) VALUES ( '${currentTime}', "undefiend", 0, ${sender_id}, ${receiver_id}, 0, 0);`);

    }
    catch(err){
        console.log("에러!~: "+err);
        errorChk = false;
        throw err;
    }
    finally{
        if (conn) {
            conn.end();

            let result;
            if(errorChk){
                console.log("insertId "+rows["insertId"]);

                return  rows["insertId"];
            } else{
                console.log("채팅방 생성 요청 에러남----");
                return -1;
            }
        };
    }
}


// 메시지 저장
async function SaveMsg(chat_room_id, chat_message, sender_id, msg_type, class_register_id){
    let conn, rows, result;
    let currentTime = getNowTimestamp();
    console.log(`SaveMsg 시작 - chat_room_id: ${chat_room_id},  chat_message: ${chat_message}, sender_id: ${sender_id}, msg_type: ${msg_type}, class_register_id: ${class_register_id}`);

    try{
        conn = await pool.getConnection();
        conn.query('USE HANGLE');
        rows = await conn.query(`INSERT INTO Chat_Message (chat_room_id, chat_message, chat_message_date, sender_id, read_check, message_type, class_register_id) VALUES (${chat_room_id}, '${chat_message}', '${currentTime}', ${sender_id}, 0, '${msg_type}', ${class_register_id})`);
        console.log("msg 저장 id:  "+rows["insertId"]);
        let msg_id = rows["insertId"];


        await updateRecentMessage(chat_room_id, msg_id, chat_message, currentTime, sender_id)
        .then((rows) => {
            // 3.메시지 저장 확인
            console.log("저장 결과: "+rows);
            if(rows == 0){
                console.log("저장 최종 결과: true");
                result =  0;
            } else{
                console.log("저장 최종 결과: false");
                result = -1;
            }
        })
        .catch((errMsg) => {
            console.log(errMsg);
            result = -1;
        });


        let resultObj = {};
        if(result == 0){
            // user_id로 정보 조회하여 object에 회원정보 저장하여 리턴
            // chat_room_id, chat_msg, sender_id,   sender_name, sender_img, msg_date
            rows = await conn.query('SELECT User.user_name, User_Detail.user_img FROM User LEFT JOIN User_Detail ON User.user_id = User_Detail.user_id  WHERE User.user_id = '+ sender_id);

            if(rows.length){
                console.log("조인 성공: ");
                console.log("user_name: "+ rows[0]['user_name']);
                console.log("user_img: "+ rows[0]['user_img']);
                resultObj.name = rows[0]['user_name'];
                resultObj.user_img = rows[0]['user_img'];
                resultObj.msg_date = currentTime;
                resultObj.result = result;

                resultObj.msg_id = msg_id;
                console.log("SaveMsg() - msg_id: "+ msg_id);

            } else{
                console.log("조인 실패: "+ rows);
                resultObj.result = result;
            }
        } else{
            resultObj.result = result;
        }

        return resultObj;

    } catch(err){
        console.log("메시지 저장 요청 에러!~: "+err);
        errorChk = false;
        throw err;
    } finally{
        if (conn) {
            conn.end();
        };
    }
}


// 채팅방 최근 메시지 update 메소드
// 1. 채팅방 table에서 user_id가 sender_id인지, receiver_id 인지 확인
// 2. 채팅방 최근 메시지 update
async function updateRecentMessage(chat_room_id, msg_id, chat_msg, msg_date, sender_id){
    console.log("채팅방 업데이트 시작 - chat_room_id: "+chat_room_id);
    let conn, rows, rows2;

    chat_room_id = parseInt(chat_room_id, 10);
    try {

        conn = await pool.getConnection();
        conn.query('USE HANGLE');
        rows = await conn.query(`SELECT sender_id, receiver_id FROM Chat_Room where chat_room_id = ${chat_room_id};`);

        if(rows.length > 0){

            console.log("채팅방 정보 조회 성공 - sender_id: "+rows[0]["sender_id"] +" - receiver_id: "+ rows[0]["receiver_id"]);

            try{
                sender_id = parseFloat(sender_id, 10);

                if(conn){
                    conn.end();
                }


                
                if(rows[0]["sender_id"] == sender_id){

                    console.log("발신자 sender_id");

                    conn = await pool.getConnection();
                    conn.query('USE HANGLE');
                    rows2 = await conn.query(`UPDATE Chat_Room SET 
                        recent_msg = '${chat_msg}',
                        recent_msg_date = '${msg_date}',
                        recent_msg_id = '${msg_id}',
                        sender_last_check = ${msg_id}
                        WHERE chat_room_id = '${chat_room_id}'
                    ;
                    `);
                } else if(rows[0]["receiver_id"] == sender_id){
                    console.log("수신자 sender_id");
                    conn = await pool.getConnection();
                    conn.query('USE HANGLE');
                    rows2 = await conn.query(`UPDATE Chat_Room SET 
                        recent_msg = '${chat_msg}',
                        recent_msg_date = '${msg_date}',
                        recent_msg_id = '${msg_id}',
                        receiver_last_check = ${msg_id}
                        WHERE chat_room_id = '${chat_room_id}'
                        ;
                        `);
                    }
    
                    console.log("채팅방 업데이트 결과값:  "+rows2["warningStatus"]);
                    const status = rows2["warningStatus"];
                    if(status == 0){
                        console.log("채팅방 업데이트 결과: true");
                        return 0;
                    } else{
                        console.log("채팅방 업데이트 결과: false");
                        return  -1;
                    }
    
                }
                catch(err){
                    console.log("채팅방 업데이트 에러1!~: "+err);
                    throw err;
                }
            } else{
                console.log("채팅방 정보 조회 실패!~: ");
            }
    
        } catch (error) {
            console.log("채팅방 업데이트 에러2!~: "+error);
        } finally{
            if (conn) {
                conn.end();
            };
        }
    }
    
    
    // 채팅방의 sender인지 receiver인지 확인
    async function SenderCheck(chatRoomId, sender_id){
        console.log("LastCheck 업데이트 시작 - "+sender_id);
        let conn, rows, errorChk = true;
    
        // sender 확인하여 sender인지 receiver인지 확인
        try{
            conn = await pool.getConnection();
            conn.query('USE HANGLE');
            rows = await conn.query(`SELECT * FROM Chat_Room where chat_room_id = ${chatRoomId}`);
            const result = rows.length;
            if(result > 0){
                if(sender_id == rows[0]["sender_id"]){
                    let result = {
                        status : 101,
                        recent_msg_id : rows[0]["recent_msg_id"]
                    };

                                    // receiver_last_check 변경
                return result;
            } else if(sender_id == rows[0]["receiver_id"]){
                let result = {
                    status : 102,
                    recent_msg_id : rows[0]["recent_msg_id"]
                };
                return result;
            } else{
                let result = {
                    status : 103,
                    recent_msg_id : rows[0]["recent_msg_id"]
                };
                return result;
            }
        }

    }
    catch(err){
        console.log("LastCheck 업데이트 에러!~: "+err);
        throw err;
    }
    finally{
        if (conn) {
            conn.end();

        };
    }

}


// last_check 업데이트
async function UpdateLastCheck(chat_room_id, sender_check){
    let conn, rows;

    // last_check 업데이트
    try{
        conn = await pool.getConnection();
        conn.query('USE HANGLE');
        if(sender_check["status"] == 101){
            console.log("상태 101");
            // receiver_last_check 업데이트 
            rows = await conn.query(`UPDATE Chat_Room SET 
                receiver_last_check = ${sender_check["recent_msg_id"]}
                WHERE chat_room_id = ${chat_room_id}
                ;
            `);
        } else if(sender_check["status"] == 102){
            console.log("상태 102");
            // sender_last_check 업데이트 
            rows = await conn.query(`UPDATE Chat_Room SET 
                sender_last_check = ${sender_check["recent_msg_id"]}
                WHERE chat_room_id = ${chat_room_id}
                ;
            `);
        } else{
            rows = {};
            rows["warningStatus"] = -1;
        }

        console.log("LastCheck 업데이트 결과값: "+rows["warningStatus"]);
        const status = rows["warningStatus"];
        if(status == 0){
            console.log("LastCheck 업데이트 결과: true");
            return 0;
        } else{
            console.log("LastCheck 업데이트 결과: false");
            return -1;
        }

    }
    catch(err){
        console.log("LastCheck 업데이트 에러!~: "+err);
        throw err;
    } finally{
        if(conn){
            conn.end();
        }

    }
}


// 회원 이름, 프로필 조회
async function GetUserData(user_id){
    let conn, rows;
    let userDataObj = {};

    try{
        conn = await pool.getConnection();
        conn.query('USE HANGLE');
        rows = await conn.query('SELECT User.user_name, User_Detail.user_img FROM User LEFT JOIN User_Detail ON User.user_id = User_Detail.user_id  WHERE User.user_id = '+ user_id);
        console.log(`GetUserData.length: ${rows.length}`);

        if(rows.length > 0){
            userDataObj.result = 101;
            userDataObj.name = rows[0]["user_name"];
            userDataObj.user_img = rows[0]["user_img"];
        }
        
    }
    catch(err){
        userDataObj.result = -1;
        throw "GetUserData-err: "+ err;
    }
    finally{
        if (conn) conn.end();
        return userDataObj;
    }
}


// 채팅룸_id 조회
async function GetChatRoomId(user1_id, user2_id){
    let conn, rows;
    let chatRoomObj = {};
    try{
        conn = await pool.getConnection();
        conn.query('USE HANGLE');
        rows = await conn.query('SELECT chat_room_id FROM Chat_Room WHERE (sender_id = '+ user1_id+' OR receiver_id = '+user1_id+ ') AND (sender_id = '+ user2_id+' OR receiver_id = '+user2_id+')');
        if(rows.length > 0){
            console.log("chat_room_id: "+rows[0]['chat_room_id']);

            chatRoomObj.result = 101;
            chatRoomObj.chat_room_id = rows[0]['chat_room_id'];

        } else{
            console.log("채팅방 없어서 채팅방 생성");
            let chat_room_id = await CreateChatRoom(user1_id, user2_id);
            if(chat_room_id != -1){
                chatRoomObj.result = 102;
                chatRoomObj.chat_room_id = chat_room_id;
            } else{
                chatRoomObj.result = -1;
            }

        }
    }
    catch(err){
        throw "GetChatRoomId-err: "+ err;
    }
    finally{
        if (conn) conn.end();
        return chatRoomObj;
    }
}

// 클래스_name 조회
async function GetClassName(class_id){
    let conn, rows;
    let classObj = {};
    try{
        conn = await pool.getConnection();
        conn.query('USE HANGLE');
        rows = await conn.query('SELECT class_name FROM Class_List where class_id = '+ class_id);
        if(rows.length > 0){
            console.log("class_name: "+rows[0]['class_name']);
            classObj.result = 101;
            classObj.class_name = rows[0]['class_name'];

        } else{
            classObj.result = -1;
        }
    }
    catch(err){
        throw "GetClassName-err: "+ err;
    }
    finally{
        if (conn) conn.end();
        return classObj;
    }
}

// 강상 이름, 이미지 및 payment_link 조회
async function GetTeacherData(user_id){
    let conn, rows;
    let teacherDataObj = {};
    let linkArr = [];
    try{
        conn = await pool.getConnection();
        conn.query('USE HANGLE');
        rows = await conn.query('SELECT Payment_Link.payment_link, User.user_name, User_Detail.user_img FROM Payment_Link LEFT JOIN User_Detail ON Payment_Link.user_id_payment = User_Detail.user_id LEFT JOIN User ON Payment_Link.user_id_payment = User.user_id WHERE Payment_Link.user_id_payment = '+ user_id);
        console.log(`GetTeacherData.length: ${rows.length}`);

        for(let i = 0; i < rows.length; i++){
            linkArr[i] = rows[i]["payment_link"];
        }
        teacherDataObj.result = 101;
        teacherDataObj.name = rows[0]["user_name"];
        teacherDataObj.user_img = rows[0]["user_img"];
        teacherDataObj.linkArr = linkArr;
    }
    catch(err){
        teacherDataObj.result = -1;
        throw "GetTeacherData-err: "+ err;
    }
    finally{
        if (conn) conn.end();
        return teacherDataObj;
    }
}







// 채팅방 입장 시 last_check 변경
async function EnterUpdateLastCheck(chat_room_id, user_id){
    let conn, rows, rows2 ;
    let resultObj = {};
    try{
        conn = await pool.getConnection();
        conn.query('USE HANGLE');
        rows = await conn.query('SELECT recent_msg_id, sender_id FROM Chat_Room WHERE chat_room_id = '+ chat_room_id);
        console.log(`GetTeacherData.length: ${rows.length}`);

        if(rows.length > 0){
            console.log("recent_msg_id 확인 성공");
            const recent_msg_id = rows[0]["recent_msg_id"];
            const sender_id = resultObj.sender_id = rows[0]["sender_id"];


            console.log("user_id: "+ user_id + " - sender_id: "+ sender_id+" - recent_msg_id: "+recent_msg_id);

            try {
                if(user_id == sender_id){
                    if(conn){
                        conn.end();
                    }
                    conn = await pool.getConnection();
                    conn.query('USE HANGLE');
                    rows2 = await conn.query(`UPDATE Chat_Room SET 
                        sender_last_check = ${recent_msg_id}
                        WHERE chat_room_id = ${chat_room_id}
                        ;
                    `);
                } else{
                    if(conn){
                        conn.end();
                    }
                    conn = await pool.getConnection();
                    conn.query('USE HANGLE');
                    rows2 = await conn.query(`UPDATE Chat_Room SET 
                        receiver_last_check = ${recent_msg_id}
                        WHERE chat_room_id = ${chat_room_id}
                        ;
                    `);
                }

                console.log("채팅방 입장 last_check 업데이트 - warningStatus: "+rows2["warningStatus"]);
                if(rows2["warningStatus"] == 0){
                    console.log("채팅방 입장 last_check 업데이트 성공");
                    resultObj.result = 0;
                } else{
                    console.log("채팅방 입장 last_check 업데이트 실패");
                    resultObj.result = -1;
                }

            } catch (error) {
                resultObj.result = -1;
                console.log("EnterUpdateLastCheck-err2"+ err);
                throw "EnterUpdateLastCheck-err2: "+ err;
            }

        } else{
            console.log("recent_msg_id 확인 실패");
            resultObj.result = -1;
        }

    }
    catch(err){
        resultObj.result = -1;
        console.log("EnterUpdateLastCheck-err1"+ err);
        throw "EnterUpdateLastCheck-err1: "+ err;
    }
    finally{
        if (conn) conn.end();
        return resultObj;
    }

}

function getNowTimestamp(){
    let currentTime = new Date().toISOString();
    currentTime = currentTime.replace('T', ' ');
    currentTime = currentTime.replace('Z', '');
    return currentTime;
}



module.exports = {
    getUserData: GetUserData,
    createChatRoom: CreateChatRoom,
    saveMsg: SaveMsg,
    updateLastCheck: UpdateLastCheck,
    senderCheck: SenderCheck,
    getChatRoomId: GetChatRoomId,
    getClassName: GetClassName,
    getTeacherData: GetTeacherData,
    enterUpdateLastCheck: EnterUpdateLastCheck
}

