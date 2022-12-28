const mariadb = require('mariadb');
const vals = require('../consts.js');
 
const pool = mariadb.createPool({
    host: vals.DBHost, port:vals.DBPort,
    user: vals.DBUser, password: vals.DBPass,
    connectionLimit: 5
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
        if (conn) conn.end();
        return chat_room_list;
    }
}


module.exports = {
    getJoinChatRoomList: GetJoinChatRoomList
}