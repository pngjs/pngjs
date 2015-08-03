var serveStatic = require('serve-static');
//var serveIndex = require('serve-index');
var http = require('http');
var connect = require('connect');

var app = connect();
server = http.createServer(app);

app.use(serveStatic('test'));
//app.use(serveIndex('test'));

server.listen(8000);

console.log("Tests available at http://localhost:8000/");
