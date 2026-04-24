/**
 * webSocketManager.js
 *
 * Low-latency WebSocket streaming: RTSP → FFmpeg → fragmented MP4 → WebSocket.
 *
 * The browser receives binary fMP4 chunks and feeds them into a MediaSource
 * SourceBuffer (MSE), giving ~1-3 second end-to-end latency — much lower than
 * the 6-10 s latency of the HLS path.
 *
 * Usage
 * -----
 * POST   /api/ws-streams        { id, rtspUrl }  → starts stream, returns wsUrl
 * GET    /api/ws-streams        → list active WS streams
 * GET    /api/ws-streams/:id    → info for one stream
 * DELETE /api/ws-streams/:id    → stop stream
 *
 * Clients connect to:  ws://host:3001/api/ws-streams/<id>/live
 */

import { WebSocketServer, WebSocket } from 'ws';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Reuse the same FFmpeg resolution logic as streamManager.js
function resolveFfmpegPath() {
  if (process.env.FFMPEG_PATH) {
    return process.env.FFMPEG_PATH;
  }
  try {
    const require = createRequire(import.meta.url);
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
      return ffmpegStatic;
    }
  } catch {
    // fall through
  }
  return 'ffmpeg';
}

const FFMPEG_BIN = resolveFfmpegPath();

class WebSocketStreamManager {
  constructor() {
    /** Map<streamId, { process, wss, clients: Set, rtspUrl, startTime, mimeType }> */
    this.wsStreams = new Map();
  }

  /**
   * Attach WebSocket upgrade handler to an existing http.Server instance.
   * Must be called once after the Express server is created.
   */
  attachToHttpServer(httpServer) {
    httpServer.on('upgrade', (request, socket, head) => {
      const { pathname } = new URL(request.url, 'http://localhost');
      // Expected path: /api/ws-streams/<id>/live
      const match = pathname.match(/^\/api\/ws-streams\/([^/]+)\/live$/);
      if (!match) {
        socket.destroy();
        return;
      }
      const streamId = match[1];
      const entry = this.wsStreams.get(streamId);
      if (!entry) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
      }
      entry.wss.handleUpgrade(request, socket, head, (ws) => {
        entry.wss.emit('connection', ws, request);
      });
    });
  }

  /**
   * Start a new WebSocket stream.
   * @param {string} streamId  Unique stream identifier
   * @param {string} rtspUrl   Source RTSP URL
   * @returns {Promise<{wsPath: string, mimeType: string}>}
   */
  async startStream(streamId, rtspUrl) {
    if (this.wsStreams.has(streamId)) {
      await this.stopStream(streamId);
    }

    const wss = new WebSocketServer({ noServer: true });
    const clients = new Set();

    // The MIME type needed by the browser MediaSource API.
    // H.264 + AAC inside fMP4 is universally supported.
    const mimeType = 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"';

    /** @type {Buffer | null} The moov initialisation segment (sent to new clients) */
    let initSegment = null;
    let ffmpegReady = false;

    wss.on('connection', (ws) => {
      clients.add(ws);
      // Send the cached init segment so the new client can initialise its MSE SourceBuffer immediately.
      if (initSegment) {
        ws.send(initSegment, { binary: true });
      }
      ws.on('close', () => clients.delete(ws));
      ws.on('error', (err) => {
        console.error(`[WS ${streamId}] client error:`, err.message);
        clients.delete(ws);
      });
    });

    const entry = { wss, clients, rtspUrl, startTime: Date.now(), mimeType, process: null };
    this.wsStreams.set(streamId, entry);

    return new Promise((resolve, reject) => {
      console.log(`[WebSocketManager] Starting stream ${streamId}: ${rtspUrl}`);

      const ffmpegArgs = [
        '-loglevel', 'warning',
        '-rtsp_transport', 'tcp',
        '-i', rtspUrl,
        // Video: H.264 baseline (widest browser support), lowest-latency preset
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-profile:v', 'baseline',
        '-level', '3.0',
        // Audio: AAC-LC
        '-c:a', 'aac',
        '-b:a', '64k',
        // Output: fragmented MP4 piped to stdout
        '-f', 'mp4',
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof+faststart',
        '-frag_duration', '500000',  // 0.5 s fragments
        'pipe:1',
      ];

      const proc = spawn(FFMPEG_BIN, ffmpegArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
      entry.process = proc;

      let chunkBuffer = Buffer.alloc(0);

      proc.stdout.on('data', (chunk) => {
        // Cache the first chunk — it contains the fMP4 moov (init segment).
        if (!initSegment) {
          initSegment = chunk;
        }

        chunkBuffer = Buffer.concat([chunkBuffer, chunk]);

        // Resolve the promise on first data so the caller knows the stream is live.
        if (!ffmpegReady) {
          ffmpegReady = true;
          resolve({ wsPath: `/api/ws-streams/${streamId}/live`, mimeType });
        }

        // Broadcast to all connected clients.
        clients.forEach((ws) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(chunk, { binary: true });
          }
        });

        // Keep chunkBuffer small — we only need the latest init segment.
        if (chunkBuffer.length > 10 * 1024 * 1024) {
          chunkBuffer = Buffer.alloc(0);
        }
      });

      proc.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg) console.log('[FFmpeg WS %s]', streamId, msg);
      });

      proc.on('error', (err) => {
        console.error(`[WebSocketManager] FFmpeg error for ${streamId}:`, err.message);
        this.wsStreams.delete(streamId);
        if (!ffmpegReady) reject(err);
      });

      proc.on('close', (code) => {
        console.log(`[WebSocketManager] FFmpeg closed for ${streamId} (code ${code})`);
        // Notify all connected clients that the stream ended.
        clients.forEach((ws) => ws.close());
        this.wsStreams.delete(streamId);
        if (!ffmpegReady) {
          reject(new Error(`FFmpeg exited with code ${code} before producing output`));
        }
      });

      // Safety timeout — if FFmpeg produces no output in 30 s, give up.
      setTimeout(() => {
        if (!ffmpegReady) {
          proc.kill('SIGKILL');
          this.wsStreams.delete(streamId);
          reject(new Error('Timeout waiting for FFmpeg to produce output (30 s)'));
        }
      }, 30000);
    });
  }

  /** Stop a running WebSocket stream. */
  async stopStream(streamId) {
    const entry = this.wsStreams.get(streamId);
    if (!entry) return;

    console.log(`[WebSocketManager] Stopping stream ${streamId}`);
    if (entry.process) {
      entry.process.kill('SIGTERM');
      setTimeout(() => {
        if (entry.process && entry.process.exitCode === null) {
          entry.process.kill('SIGKILL');
        }
      }, 5000);
    }
    entry.clients.forEach((ws) => ws.close());
    entry.wss.close();
    this.wsStreams.delete(streamId);
  }

  /** Stop all active WebSocket streams (called on server shutdown). */
  async stopAllStreams() {
    const ids = Array.from(this.wsStreams.keys());
    await Promise.all(ids.map((id) => this.stopStream(id)));
  }

  /** Check whether a stream is currently active. */
  isStreamActive(streamId) {
    return this.wsStreams.has(streamId);
  }

  /** Return a list of all active WebSocket streams. */
  getActiveStreams() {
    return Array.from(this.wsStreams.entries()).map(([id, entry]) => ({
      id,
      rtspUrl: entry.rtspUrl,
      wsPath: `/api/ws-streams/${id}/live`,
      mimeType: entry.mimeType,
      startTime: entry.startTime,
      uptime: Date.now() - entry.startTime,
      clients: entry.clients.size,
    }));
  }
}

export default new WebSocketStreamManager();
