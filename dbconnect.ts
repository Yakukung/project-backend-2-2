import mysql from "mysql";
import util from "util";
export const conn = mysql.createPool({
  connectionLimit: 10,
  host: "202.28.34.197",
  user: "web66_65011212083",
  password: "65011212083@csmsu",
  database: "web66_65011212083",

  // connectionLimit: 10,
  // host: "localhost",
  // user: "web_work5",
  // password: "",
  // database: "web_work5",

  
});

export { mysql, util };
export const queryAsync = util.promisify(conn.query).bind(conn);

// import mysql from "mysql";
// import util from "util";
// export const conn = mysql.createPool({
//   connectionLimit: 10,
//   host: "202.28.34.197",
//   user: "tripbooking",
//   password: "tripbooking@csmsu",
//   database: "tripbooking",
// });

// export { mysql };

// export const queryAsync = util.promisify(conn.query).bind(conn);
