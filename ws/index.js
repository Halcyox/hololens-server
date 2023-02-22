const { clear } = require('console'), // Import clear method from the console module
      crypto = require('crypto'), // Import the crypto module for generating cryptographic values
      express = require('express'), // Import the Express.js framework
      { createServer } = require('http'), // Import the createServer method from the http module
      WebSocket = require('ws'), // Import the WebSocket module
      { EventEmitter } = require('events'), // Import the EventEmitter class from the events module
      app = express(), // Create a new Express.js app
      unity_port = 3001, // Port for Unity connection
      bci_port = 3000, // Port for BCI connection
      intervalTime = 30000, // Interval time for BCI server
      debugMode = false, // Boolean for debug mode
      interchange = new EventEmitter(); // Create a new EventEmitter instance for inter-component communication
let      anyBciFound = false; // Boolean for BCI device status

class Interchange extends EventEmitter {} // Define a new class that extends EventEmitter to use as the inter-component communication channel

console.clear(); // Clear the console when the script runs

// Define a function that emits a 'bciAnswer' event with a random 'yes' or 'no' string
function sendRandBciOutput() {
    interchange.emit('bciAnswer', JSON.stringify(Math.random() < 0.5 ? 'yes' : 'no'))
}

if (debugMode) { //if debug mode is on, send random bci output every intervalTime seconds
    //setInterval(sendRandBciOutput, intervalTime); // call sendRandBciOutput() every intervalTime seconds using setInterval()
}

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
        interchange.on('commandBci', commandBci);
        interchange.emit("foundBci");
        bci_conn.on('message', function(msgstr, binary) {
           const msg = binary ? msgstr : msgstr.toString();
           console.debug(`Raw data string: ${msg}`);
           const tagged_data = JSON.parse(msg);
           console.debug(tagged_data)

           console.info(`BCI response -> ${tagged_data.data.answer}`);
            if (!debugMode) {
                interchange.emit('bciAnswer', JSON.stringify(tagged_data.data.answer));
            } else {
                console.warn("NOTICE: debug mode! not forwarding bciAnswer to interchange....");
            }
        });
        bci_conn.on('close', function() {
            console.error("BCI disconnected, not gonna crash, gonna reset anyBciFound to false.");
            anyBciFound = false;
        });
    });

    server.listen(port);
    console.info(`Started bci listener on TCP:${port}`);
}

function unityServer(app, port) {
    const server = createServer(app);
    const wss = new WebSocket.Server({
        server
    });
    const connections = [];

    function foundBci() {
        console.info("foundBci event occured");
        connections.forEach(client => {
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
            console.debug("Unity sent data -> " + data);
            if (data == "START_COMMAND") {
                interchange.emit('commandBci', data);
	        	if (debugMode)  {
		        	setTimeout(sendRandBciOutput, 15000);
        		}
                console.log(`emitted commandBci(${data})`);
            } else if (data == "ARE_YOU_THERE_BCI") {
	        	console.debug("was asked: ARE_YOU_THERE_BCI");
                // If we get a message from the Unity scene that asks for if the BCI is available, we must respond true/false
                ws.send(JSON.stringify({
                    type: "BciConnectedStatus",
                    //data: anyBciFound
                    data: true
                }));
            }
        });
    });

    wss.on('close', function() {
        console.info(`Unity client ${ws} lost.`);
        console.debug(`Remaining connections: ${connections}`);
        connections.splice(connections.indexOf(ws), 1);
    });

    server.listen(port);
    console.info(`Unity server function is now listening on TCP:${port}`);

    return function broadcast(data) {
        connections.forEach(client => client.send(data));
    };
}

//unityServer(app, unity_port);
//bciServer(app, bci_port);

const broadcast = unityServer(app, unity_port);
bciServer(app, bci_port);
