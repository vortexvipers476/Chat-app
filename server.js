const express = require('express');
const next = require('next');
const { createServer } = require('http');
const { parse } = require('url');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();
  const httpServer = createServer(server);
  const io = new Server(httpServer);

  // Socket.io connection handler
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Handle new messages
    socket.on('chat message', (msg) => {
      io.emit('chat message', msg); // Broadcast to all clients
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  // Handle Next.js routes
  server.all('*', (req, res) => {
    const parsedUrl = parse(req.url, true);
    return handle(req, res, parsedUrl);
  });

  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${PORT}`);
  });
});
