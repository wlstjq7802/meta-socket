function DecodeJWT(jwt){
    /*
    @ 복호화 순서
    1. jwt 받기
    2. base64로 decode
    3. .단위로 분리
    4. payload 파싱
    5. json에서 User_ID 파싱
    */

    // 1. jwt 받기
    
    try {
        // 2. base64로 decode
        // 결과:
        // {"alg":"sha256","typ":"JWT"}.{"User_ID":"MTEw","U_Name":"aG9uZzQ=","U_Email":"aG9uZzRAbmF2ZXIuY29t"}.27f4789673b1e5ddc6f74ae2644f448be378dfccfb4c3f53731250353390db2b
        // header.payload.SIGNATURE 구조로 되어있음
        result = atob(jwt);  // 토큰 base64 decode

        console.log('토큰 확인');
    } catch(e) {
        console.log('잘못된 토큰');
        result = "";
    }


    if(result != ""){ // 토큰 확인
        // 3. .단위로 분리
        // header.payload.SIGNATURE 구조로 되어있는 값에서 payload만 파싱하기
        //위해 배열에 .단위로 분리
        // 결과: jwtArr[0] = header, jwtArr[1] = payload, jwtArr[2] = SIGNATURE
        var jwtArr = result.split('.'); // payload 파싱
        var payload;
    }

    try {
        // 4.payload 파싱
        // {"User_ID":"MTEw","U_Name":"aG9uZzQ=","U_Email":"aG9uZzRAbmF2ZXIuY29t"}값을
        //json으로 변환
        payload = JSON.parse(jwtArr[1]); // json으로 변환
    } catch(e) {
        console.log('잘못된 토큰');
        socket.emit('joinMetaErr', e);
        payload = "";
    }


    if(payload != ""){ // json 파싱 확인

        // 5.json에서 User_ID 파싱
        var user_id = atob(payload.User_ID);
        return user_id;
    } else{
        return -1;
    }


}

module.exports = {
    decodeJWT: DecodeJWT
}