const { loadEnvConfig } = require('@next/env');
const projectDir = process.cwd();
loadEnvConfig(projectDir);

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server: ServerIO } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Normalize any ID (ObjectId object, {$oid:...}, or plain string) to a string
const getId = (id) => {
  if (!id) return '';
  if (typeof id === 'string') return id;
  if (typeof id === 'object' && id.$oid) return id.$oid;
  if (typeof id === 'object' && typeof id.toString === 'function') {
    const s = id.toString();
    // MongoDB ObjectId.toString() returns hex string - but plain "[object Object]" means it failed
    if (s !== '[object Object]') return s;
  }
  return String(id);
};

const { MongoClient, ObjectId } = require('mongodb');

// Connect standalone mongo client for user presence tracking
const mongoClient = new MongoClient(process.env.MONGODB_URI);
mongoClient.connect().then(() => console.log('[SOCKET] MongoDB connected for presence tracking')).catch(console.error);

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      if (parsedUrl.pathname && parsedUrl.pathname.startsWith('/socket.io/')) {
        return;
      }
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new ServerIO(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['polling', 'websocket'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 60000,
  });

  global.io = io;

  io.on('connection', (socket) => {
    const startId = socket.id.substring(0, 5);
    console.log(`[SOCKET] 🟢 Client connected: ${socket.id} (${startId})`);

    // Heartbeat to keep connection alive
    socket.on('ping', () => {
      socket.emit('pong');
    });

    socket.on('join-room', (roomId) => {
      const rId = getId(roomId);
      if (!rId) {
        console.warn(`[SOCKET][${startId}] ⚠️ join-room: invalid roomId`);
        return;
      }

      // Check if already in room
      if (socket.rooms.has(rId)) {
        console.log(`[SOCKET][${startId}] 🆗 Already in room: ${rId}`);
        return;
      }

      socket.join(rId);
      console.log(`[SOCKET][${startId}] 🚪 Joined room: "${rId}" | rooms:`, [...socket.rooms]);
    });

    socket.on('join-user', (userId) => {
      const uId = getId(userId);
      if (!uId) {
        console.warn(`[SOCKET][${startId}] ⚠️ join-user: invalid userId`);
        return;
      }

      socket.join(uId);
      socket.userId = uId;
      console.log(`[SOCKET][${startId}] 🆔 Joined personal room: "${uId}"`);

      // Update DB to online instantly
      mongoClient.db('tradelog_main').collection('users').updateOne(
        { _id: new ObjectId(uId) },
        { $set: { onlineStatus: 'online' } }
      ).catch(err => console.error(`[SOCKET][${startId}] ❌ Failed to set user online:`, err));

      socket.broadcast.emit('presence-update', { userId: uId, status: 'online' });
    });

    socket.on('send-message', (data) => {
      const convId = getId(data.conversationId);
      const senderId = socket.userId || 'unknown';

      if (!convId) {
        console.error(`[SOCKET][${startId}] ❌ send-message attempt without roomId`);
        return;
      }

      console.log(`[SOCKET][${startId}] 📩 Msg from ${senderId} to room: "${convId}"`);

      // Re-verify room membership just in case
      if (!socket.rooms.has(convId)) {
        console.warn(`[SOCKET][${startId}] ⚠️ Socket tried to send to room it's not in. Joining now: ${convId}`);
        socket.join(convId);
      }

      // 1. Send to others in the conversation room
      socket.to(convId).emit('receive-message', data);

      // 2. Send notifications to ALL participants' personal rooms
      // This ensures sidebar updates even if they don't have the chat open
      if (data.participants && Array.isArray(data.participants)) {
        data.participants.forEach((pId) => {
          const pRoom = getId(pId);
          if (pRoom) {
            // We use socket.to(pRoom) which excludes current socket, 
            // but for recipients this is exactly what we want.
            socket.to(pRoom).emit('new-message-notification', data);
          }
        });
      }
    });

    socket.on('typing', (data) => {
      const convId = getId(data.conversationId);
      if (convId) socket.to(convId).emit('user-typing', data);
    });

    socket.on('stop-typing', (data) => {
      const convId = getId(data.conversationId);
      if (convId) socket.to(convId).emit('user-stop-typing', data);
    });

    socket.on('mark-read', (data) => {
      const convId = getId(data.conversationId);
      if (convId) socket.to(convId).emit('message-read', data);
    });

    socket.on('edit-message', (data) => {
      const convId = getId(data.conversationId);
      if (convId) socket.to(convId).emit('message-edited', data);

      // Also notify participants (sidebar snippet might change)
      if (data.participants && Array.isArray(data.participants)) {
        data.participants.forEach(pId => {
          const pRoom = getId(pId);
          if (pRoom) socket.to(pRoom).emit('new-message-notification', { ...data, isEdit: true });
        });
      }
    });

    socket.on('delete-message', (data) => {
      const convId = getId(data.conversationId);
      if (convId) socket.to(convId).emit('message-deleted', data);
    });

    socket.on('react-message', (data) => {
      const convId = getId(data.conversationId);
      if (convId) socket.to(convId).emit('message-reacted', data);
    });

    socket.on('new-invite', (data) => {
      const rId = getId(data.receiverId);
      if (rId) socket.to(rId).emit('receive-invite', data);
    });

    socket.on('invite-accepted', (data) => {
      const sId = getId(data.senderId);
      if (sId) socket.to(sId).emit('receive-invite-accepted', data);
    });

    socket.on('new-conversation', (data) => {
      if (data.participants && Array.isArray(data.participants)) {
        data.participants.forEach((pId) => {
          const pRoom = getId(pId);
          if (pRoom) socket.to(pRoom).emit('conversation-created', data);
        });
      }
    });

    socket.on('delete-conversation', (data) => {
      if (data.participants && Array.isArray(data.participants)) {
        data.participants.forEach((pId) => {
          const pRoom = getId(pId);
          if (pRoom) socket.to(pRoom).emit('conversation-deleted', data);
        });
      }
    });

    socket.on('update-presence', (data) => {
      const uId = getId(data.userId);
      if (uId) {
        socket.userId = uId;
        socket.broadcast.emit('presence-update', { userId: uId, status: data.status });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[SOCKET] 🔴 Client disconnected: ${socket.id} (${startId}) | reason: ${reason}`);
      const userId = socket.userId;
      if (userId) {
        socket.broadcast.emit('presence-update', { userId, status: 'offline' });

        // Update DB to offline instantly
        mongoClient.db('tradelog_main').collection('users').updateOne(
          { _id: new ObjectId(userId) },
          { $set: { onlineStatus: 'offline' } }
        ).catch(err => console.error(`[SOCKET][${startId}] ❌ Failed to set user offline:`, err));
      }
    });

    socket.on('error', (err) => {
      console.error(`[SOCKET][${startId}] 🏮 Error:`, err);
    });
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log('> Socket.IO server running on default path /socket.io/');
    });
});
