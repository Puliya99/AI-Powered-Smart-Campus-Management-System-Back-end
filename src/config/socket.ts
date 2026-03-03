import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { IsNull } from 'typeorm';
import { logger } from '../utils/logger';
import { AppDataSource } from './database';
import { MeetingParticipant } from '../entities/MeetingParticipant.entity';

interface SocketData {
  userId:      string;
  userName:    string;
  role:        'LECTURER' | 'STUDENT' | string;
  meetingId?:  string;
  meetingCode?: string;
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
        meetingId?:  string;
        userId:      string;
        userName:    string;
        role:        'LECTURER' | 'STUDENT';
      }) => {
        const { meetingCode, meetingId, userId, userName, role } = data;

        socket.data = { userId, userName, role, meetingId, meetingCode } as SocketData;

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

    // Chat messages – relay to everyone else in the room (sender adds their own
    // message locally so they always see it regardless of room membership state)
    socket.on(
      'chat-message',
      (payload: { meetingCode: string; text: string; senderName: string; senderId: string }) => {
        socket.to(payload.meetingCode).emit('chat-message', {
          text: payload.text,
          senderName: payload.senderName,
          senderId: payload.senderId,
          socketId: socket.id,
          timestamp: new Date().toISOString(),
        });
      }
    );

    // Screen share signaling – relay to everyone else in the room
    socket.on('screen-share-started', ({ meetingCode }: { meetingCode: string }) => {
      socket.to(meetingCode).emit('screen-share-started', { socketId: socket.id });
    });

    socket.on('screen-share-stopped', ({ meetingCode }: { meetingCode: string }) => {
      socket.to(meetingCode).emit('screen-share-stopped', { socketId: socket.id });
    });

    // When user leaves / disconnects
    socket.on('disconnect', async () => {
      logger.info(`Socket disconnected: ${socket.id}`);

      // ── Mark leave time in DB when browser tab is closed or connection drops ──
      const { userId, meetingId } = socket.data as SocketData;
      if (userId && meetingId && AppDataSource.isInitialized) {
        try {
          await AppDataSource.getRepository(MeetingParticipant).update(
            {
              meeting: { id: meetingId },
              user:    { id: userId },
              leftAt:  IsNull(),
            },
            { leftAt: new Date() }
          );
        } catch (err) {
          logger.error('Failed to update leftAt on socket disconnect:', err);
        }
      }

      for (const roomCode in rooms) {
        if (rooms[roomCode].has(socket.id)) {
          rooms[roomCode].delete(socket.id);

          // Notify others in room
          io.to(roomCode).emit('user-left', socket.id);
          // Clear spotlight if this user was sharing
          io.to(roomCode).emit('screen-share-stopped', { socketId: socket.id });

          if (rooms[roomCode].size === 0) {
            delete rooms[roomCode];
          }
        }
      }
    });
  });

  return io;
};
