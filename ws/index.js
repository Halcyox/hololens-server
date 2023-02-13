const {
    clear
} = require('console');
const crypto = require('crypto');
const express = require('express');
const {
    createServer
} = require('http');
const WebSocket = require('ws');
const {
    EventEmitter
} = require('events');

const app = express();
const unity_port = 3001;
const bci_port = 3000;

class Interchange extends EventEmitter {}

const interchange = new Interchange();
let anyBciFound = false;

function bciServer(app, port) {
    const server = createServer(app);
    const wss = new WebSocket.Server({
        server
    });
    wss.on('connection', function(bci_conn) {
        console.log("BCI client joined.");
        anyBciFound = true;
        const alivePing = setInterval(() => bci_conn.send("ping"), 5000);
        const commandBci = (data) => {
            bci_conn.send(data);
        }
        interchange.on('commandBci', commandBci)
        interchange.emit("foundBci");
        //bci_conn.on('message', function(msgstr, binary) {
        //    const msg = binary ? msgstr : msgstr.toString();
        //    const tagged_data = JSON.parse(msg);
        //    console.log(Object.getOwnPropertyNames(tagged_data));
        //    console.log(`BCI response -> ${tagged_data.data.answer}`);
            
	//    interchange.emit('bciAnswer', "yes");
            //interchange.emit('bciAnswer', JSON.stringify(tagged_data.data.answer));

        //});
        
	 
        function sendRandBciOutput() {
	 const randString = Math.random() < 0.5 ? 'yes' : 'no'; // randomly generates 'yes', 'no'
	 interchange.emit('bciAnswer', randString); // emit 'bciAnswer' event with randString as argument	
	}
	setInterval(sendRandBciOutput,20000); // call sendRandBciOutput() every 20 seconds using setInterval()

        bci_conn.on('close', function() {
            console.log("BCI disconnected, crashing so as to restart.");
            anyBciFound = false;
        });

    });

    server.listen(port);
    console.log(`Started bci listener on ${port}`);
}

function unityServer(app, port) {
    const server = createServer(app);
    const wss = new WebSocket.Server({
        server
    });
    const connections = [];

    function foundBci() {
        connections.forEach(client => {
            console.info("bruh");
            client.send("foundBci");
        });
    }

    function bciAnswer(data) {
        connections.forEach(client => client.send(data));
    };

    interchange.on('foundBci', foundBci);
    interchange.on('bciAnswer', (data) => connections.forEach(client => client.send(data)));

    wss.on('connection', function(ws) {
        console.info(`Unity client ${ws} joined.`);
        connections.push(ws);
        ws.on('message', function(data, binary) {
            data = binary ? data : data.toString();
            console.log("Unity sent data -> " + data);
            if (data == "START_COMMAND") {
                interchange.emit('commandBci', data);
                console.log("emitted commandBci");
            } else if (data == "ARE_YOU_THERE_BCI") {
                // If we get a message from the Unity scene that asks for if the BCI is available, we must respond yes/no
                ws.send(JSON.stringify({
                    type: "BciConnectedStatus",
                    data: anyBciFound
                }));
                interchange.emit('anyBciFound', {
                    type: "BciConnectedStatus",
                    data: anyBciFound
                });
            }
        });
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
