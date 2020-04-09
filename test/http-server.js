let serveStatic = require("serve-static");
let http = require("http");
let connect = require("connect");

let app = connect();
let server = http.createServer(app);

app.use(serveStatic("test"));

server.listen(8000);

module.exports = () => {
  server.close();
};

console.log("Tests available at http://localhost:8000/");
