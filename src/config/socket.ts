import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from '../utils/logger';

interface SocketData {
  userId: string;
  userName: string;
  role: 'LECTURER' | 'STUDENT';
}

const rooms: Record<string, Set<string>> = {}; // meetingCode → Set<socket.id>

export let io: Server;

export const setupSocketIO = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: ['http://localhost:3000', 'https://your-frontend-domain.com'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication token required'));
    }
    // You can add JWT verification here if you want extra security
    // For MVP → we accept everything and rely on meeting code
    next();
  });

  io.on('connection', socket => {
    logger.info(`Socket connected: ${socket.id}`);

    socket.on(
      'join-meeting',
      async (data: {
        meetingCode: string;
        userId: string;
        userName: string;
        role: 'LECTURER' | 'STUDENT';
      }) => {
        const { meetingCode, userId, userName, role } = data;

        socket.data = { userId, userName, role } as SocketData;

        // Join socket.io room
        socket.join(meetingCode);

        if (!rooms[meetingCode]) {
          rooms[meetingCode] = new Set();
        }
        rooms[meetingCode].add(socket.id);

        // Get all other users in room (except self)
        const otherUsers = Array.from(rooms[meetingCode])
          .filter(id => id !== socket.id)
          .map(id => ({ id }));

        // Tell new user about existing users
        socket.emit('all-users', otherUsers);

        // Tell others that new user joined
        socket.to(meetingCode).emit('user-joined', {
          id: socket.id,
          userId,
          userName,
          role,
        });

        logger.info(`User ${userName} (${role}) joined meeting ${meetingCode}`);
      }
    );

    // WebRTC signaling
    socket.on(
      'sending-signal',
      (payload: { userToSignal: string; signal: any; callerID: string }) => {
        io.to(payload.userToSignal).emit('user-joined', {
          signal: payload.signal,
          callerID: payload.callerID,
        });
      }
    );

    socket.on(
      'returning-signal',
      (payload: {
        signal: any;
        id: string; // who is returning the answer
      }) => {
        io.to(payload.id).emit('receiving-returned-signal', {
          signal: payload.signal,
          id: socket.id,
        });
      }
    );

    // When user leaves / disconnects
    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);

      for (const roomCode in rooms) {
        if (rooms[roomCode].has(socket.id)) {
          rooms[roomCode].delete(socket.id);

          // Notify others in room
          io.to(roomCode).emit('user-left', socket.id);

          if (rooms[roomCode].size === 0) {
            delete rooms[roomCode];
          }
        }
      }
    });
  });

  return io;
};
