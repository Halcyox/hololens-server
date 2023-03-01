To run:

```
$ curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
$ nvm install 16
$ ./start.sh
```

This will restart the server after a 1s sleep, every time it either loses
connection from the BCI, or else some fatal exception (fail fast).

The server internally will:

- listen on two ports (3001 for unity connections, 3000 for BCI connections)
- send "ping" strings to BCI every 5s
- forward all messages from unity onwards to BCI
- forward well-formed messages from BCI onwards to unity

Internally an event emitter called `interchange` is used to coordinate
the two websocket servers.
