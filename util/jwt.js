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
    let result;
    try {
        // 2. base64로 decode
        // 결과:
        result = universalAtob(jwt);  // 토큰 base64 decode

        console.log('토큰 확인');
    } catch(e) {
        console.log('잘못된 토큰: '+e);
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
        payload = "";
    }

    let resultObj = {};

    if(payload != ""){ // json 파싱 확인

        // 5.json에서 User_ID 파싱
        resultObj.user_id = universalAtob(payload.User_ID);
        resultObj.user_name = universalAtob(payload.U_Name);

        return resultObj;
    } else{
        resultObj.user_id = -1;
        return -1;
    }


}


function universalAtob(b64Encoded) {
  try {
    return atob(b64Encoded);
  } catch (err) {
    return Buffer.from(b64Encoded, 'base64').toString();
  }
};


module.exports = {
    decodeJWT: DecodeJWT
}