'use strict';

const serveStatic = require('serve-static');
//import serveIndex from 'serve-index';
const http = require('http');
const connect = require('connect');

const app = connect();
const server = http.createServer(app);

app.use(serveStatic('test'));
//app.use(serveIndex('test'));

server.listen(8000);

console.log('Tests available at http://localhost:8000/');
