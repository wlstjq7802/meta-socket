const mdbConn = require('./mariaDBConn.js');
const express = require('express');
const app = express();
  // ddd
mdbConn.getUserList() 
  .then((rows) => {
    // var jsonObject = JSON.parse(rows);
    console.log(rows.User_ID);
  })
  .catch((errMsg) => {
    console.log("err: "+errMsg);
  });
 
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
