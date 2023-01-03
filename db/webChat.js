const mariadb = require('mariadb');
const vals = require('../consts.js');
 
const pool = mariadb.createPool({
    host: vals.DBHost, port:vals.DBPort,
    user: vals.DBUser, password: vals.DBPass,
    connectionLimit: 6
});


async function GetJoinChatRoomList(user_id){
    let conn, rows;
    let chat_room_list = [];

    try{
        conn = await pool.getConnection();
        conn.query('USE HANGLE');
        rows = await conn.query(`SELECT chat_room_id FROM Chat_Room where sender_id = ${user_id} OR receiver_id = ${user_id}`);
        
        if(rows.length > 0){
            for(let i = 0; i < rows.length; i++){
                chat_room_list[i] = rows[i]["chat_room_id"];
            }
            console.log("채팅방 목록 조회 성공 결과: "+chat_room_list.length);
        } else{
            console.log("채팅방 목록 조회 실패");
        }

    }
    catch(err){
        throw err;
    }
    finally{
        // if (conn) conn.end();
        conn.release();
        return chat_room_list;
    }
}


// Chat_Room 테이블의 exit_user_id 변경
async function UpdateExitUserId(chat_room_id, user_id){
    let conn, rows, result;
    
    try{
        conn = await pool.getConnection();
        conn.query('USE HANGLE');
        rows = await conn.query(`SELECT exit_user_id FROM Chat_Room WHERE chat_room_id = ${chat_room_id}`);
        
        if(rows.length > 0){
            let exit_user_id = parseInt(rows[0]["exit_user_id"], 10);
            if(exit_user_id == -2){
                // exit_user_id를 user_id로 update
                rows = await conn.query(`UPDATE Chat_Room SET 
                    exit_user_id = ${user_id}
                    WHERE chat_room_id = ${chat_room_id}
                    ;
                `);
            } else{
                // exit_user_id를 -1(모두 나감)로 update
                rows = await conn.query(`UPDATE Chat_Room SET 
                    exit_user_id = -1+
                    WHERE chat_room_id = ${chat_room_id}
                    ;
                `);
            }

            result = rows["warningStatus"];
            if(result == 0){
                console.log("UpdateExitUserId( ) 결과: true");
            } else{
                console.log("UpdateExitUserId( ) 결과: false");
            }

        } else{
            console.log("채팅방 목록 조회 실패");
        }

    }
    catch(err){
        result = -1;
        throw err;
    }
    finally{
        // if (conn) conn.end();
        conn.release();
        return result;
    }
}




module.exports = {
    getJoinChatRoomList: GetJoinChatRoomList,
    updateExitUserId: UpdateExitUserId
}