const { clear } = require('console');
const crypto = require('crypto');
const express = require('express');
const { createServer } = require('http');
const WebSocket = require('ws');
const { EventEmitter } = require('events');

const app = express();
const unity_port = 3001;
const bci_port = 3000;

class Interchange extends EventEmitter {}

const interchange = new Interchange();

function bciServer(app, port) {
  const server = createServer(app);
  const wss = new WebSocket.Server({ server });
  wss.on('connection', function (bci_conn) {
    const alivePing = setInterval(() => bci_conn.send("ping"), 5000);
    const commandBci = () => {
        bci_conn.send("commandBci");
    }
    interchange.on('commandBci', commandBci)
    interchange.emit("foundBci");
    bci_conn.on('message', function (msgstr, binary) {
      const msg = binary ? msgstr : msgstr.toString();
      const tagged_data = JSON.parse(msg);
      console.log(Object.getOwnPropertyNames(tagged_data));
      console.log(`BCI response -> ${tagged_data.data.answer}`);
      interchange.emit('bciAnswer', tagged_data.data.answer);
    });

    bci_conn.on('close', function () {
      console.log("BCI disconnected, crashing so as to restart.");
      process.exit(1);
    });

  });

  server.listen(port);
  console.log(`Started bci listener on ${port}`);
}

function unityServer(app,port) {
  const server = createServer(app);
  const wss = new WebSocket.Server({ server });
  const connections = [];

  wss.on('message', function (data) {
    console.log("Unity sent data -> " + data);
    interchange.emit('commandBci', data);
  });

  function foundBci() {
    connections.forEach(client => client.send("foundBci"));
  }

  function bciAnswer(data) {
    connections.forEach(client => client.send(data));
  };

  interchange.on('foundBci', foundBci);
  interchange.on('bciAnswer', (data) => connections.forEach(client => client.send(data)));

  wss.on('connection', function (ws) {
    console.info(`Unity client ${ws} joined.`);
    connections.push(ws);
  });

  wss.on('close', function() {
    console.info(`Unity client ${ws} lost.`)
    console.debug(connections);
    connections.splice(connections.indexOf(ws), 1);
  })
  
  server.listen(port);
  console.log(port);

  return function broadcast(data) {
    connections.forEach(client => client.send(data));
  };
}

//unityServer(app, unity_port);
//bciServer(app, bci_port);

const broadcast = unityServer(app, unity_port);
bciServer(app, bci_port);
