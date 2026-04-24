import express from 'express';
import cors from 'cors';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import streamManager from './streamManager.js';
import cameraDiscovery from './cameraDiscovery.js';
import webSocketManager from './webSocketManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const STATIC_PORT = process.env.STATIC_PORT || null;

// Middleware
app.use(cors());
app.use(express.json());

// Servir archivos estáticos de streams HLS
app.use('/streams', express.static(path.join(__dirname, 'streams')));

// In Docker / production mode: serve the pre-built frontend from public_dist.
// When STATIC_PORT is set we spin up a second http server on that port instead,
// so the API and the static files can be reached independently.
const staticDistPath = path.join(__dirname, 'public_dist');
import fs from 'fs';
if (fs.existsSync(staticDistPath)) {
  if (STATIC_PORT) {
    const staticApp = express();
    staticApp.use(express.static(staticDistPath));
    staticApp.get('*', (_req, res) =>
      res.sendFile(path.join(staticDistPath, 'index.html'))
    );
    staticApp.listen(Number(STATIC_PORT), () => {
      console.log(`✅ Static frontend available at: http://localhost:${STATIC_PORT}`);
    });
  } else {
    // Single-port mode: serve frontend under / and API under /api
    app.use(express.static(staticDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/streams')) return next();
      res.sendFile(path.join(staticDistPath, 'index.html'));
    });
  }
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/streams
 * Inicia un nuevo stream RTSP
 * Body: { id: string, rtspUrl: string }
 */
app.post('/api/streams', async (req, res) => {
  try {
    const { id, rtspUrl } = req.body;

    if (!id || !rtspUrl) {
      return res.status(400).json({
        error: 'Se requieren los campos: id y rtspUrl'
      });
    }

    // Validar formato RTSP URL (rtsp:// y rtsps:// para RTSP sobre TLS)
    if (!rtspUrl.startsWith('rtsp://') && !rtspUrl.startsWith('rtsps://')) {
      return res.status(400).json({
        error: 'La URL debe comenzar con rtsp:// o rtsps://'
      });
    }

    console.log(`[API] Iniciando stream: ${id}`);

    const hlsUrl = await streamManager.startStream(id, rtspUrl);

    res.json({
      success: true,
      stream: {
        id,
        rtspUrl,
        hlsUrl: `http://localhost:${PORT}${hlsUrl}`,
        status: 'active'
      }
    });
  } catch (error) {
    console.error('[API] Error al iniciar stream:', error);
    res.status(500).json({
      error: 'Error al iniciar stream',
      message: error.message
    });
  }
});

/**
 * DELETE /api/streams/:id
 * Detiene un stream activo
 */
app.delete('/api/streams/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!streamManager.isStreamActive(id)) {
      return res.status(404).json({
        error: 'Stream no encontrado o no está activo'
      });
    }

    console.log(`[API] Deteniendo stream: ${id}`);

    await streamManager.stopStream(id);

    res.json({
      success: true,
      message: `Stream ${id} detenido correctamente`
    });
  } catch (error) {
    console.error('[API] Error al detener stream:', error);
    res.status(500).json({
      error: 'Error al detener stream',
      message: error.message
    });
  }
});

/**
 * GET /api/streams
 * Obtiene la lista de streams activos
 */
app.get('/api/streams', (req, res) => {
  try {
    const streams = streamManager.getActiveStreams();

    res.json({
      success: true,
      count: streams.length,
      streams: streams.map(stream => ({
        ...stream,
        hlsUrl: `http://localhost:${PORT}${stream.hlsUrl}`
      }))
    });
  } catch (error) {
    console.error('[API] Error al obtener streams:', error);
    res.status(500).json({
      error: 'Error al obtener streams',
      message: error.message
    });
  }
});

/**
 * GET /api/streams/:id
 * Obtiene información de un stream específico
 */
app.get('/api/streams/:id', (req, res) => {
  try {
    const { id } = req.params;

    if (!streamManager.isStreamActive(id)) {
      return res.status(404).json({
        error: 'Stream no encontrado o no está activo'
      });
    }

    const streams = streamManager.getActiveStreams();
    const stream = streams.find(s => s.id === id);

    res.json({
      success: true,
      stream: {
        ...stream,
        hlsUrl: `http://localhost:${PORT}${stream.hlsUrl}`
      }
    });
  } catch (error) {
    console.error('[API] Error al obtener stream:', error);
    res.status(500).json({
      error: 'Error al obtener stream',
      message: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════
// 🔌 WEBSOCKET STREAMS (low-latency fMP4 over WebSocket)
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/ws-streams
 * Start a new low-latency WebSocket stream (RTSP → fMP4 → WebSocket).
 * Body: { id: string, rtspUrl: string }
 */
app.post('/api/ws-streams', async (req, res) => {
  try {
    const { id, rtspUrl } = req.body;

    if (!id || !rtspUrl) {
      return res.status(400).json({ error: 'Se requieren los campos: id y rtspUrl' });
    }

    if (!rtspUrl.startsWith('rtsp://') && !rtspUrl.startsWith('rtsps://')) {
      return res.status(400).json({ error: 'La URL debe comenzar con rtsp:// o rtsps://' });
    }

    console.log(`[API] Iniciando WS stream: ${id}`);

    const { wsPath, mimeType } = await webSocketManager.startStream(id, rtspUrl);

    res.json({
      success: true,
      stream: {
        id,
        rtspUrl,
        wsUrl: `ws://localhost:${PORT}${wsPath}`,
        wsPath,
        mimeType,
        status: 'active',
      },
    });
  } catch (error) {
    console.error('[API] Error al iniciar WS stream:', error);
    res.status(500).json({ error: 'Error al iniciar WS stream', message: error.message });
  }
});

/**
 * GET /api/ws-streams
 * List active WebSocket streams.
 */
app.get('/api/ws-streams', (req, res) => {
  try {
    const streams = webSocketManager.getActiveStreams();
    res.json({
      success: true,
      count: streams.length,
      streams: streams.map((s) => ({
        ...s,
        wsUrl: `ws://localhost:${PORT}${s.wsPath}`,
      })),
    });
  } catch (error) {
    console.error('[API] Error al listar WS streams:', error);
    res.status(500).json({ error: 'Error al listar WS streams', message: error.message });
  }
});

/**
 * GET /api/ws-streams/:id
 * Get info for a specific WebSocket stream.
 */
app.get('/api/ws-streams/:id', (req, res) => {
  try {
    const { id } = req.params;
    if (!webSocketManager.isStreamActive(id)) {
      return res.status(404).json({ error: 'WS stream no encontrado o no está activo' });
    }
    const stream = webSocketManager.getActiveStreams().find((s) => s.id === id);
    res.json({ success: true, stream: { ...stream, wsUrl: `ws://localhost:${PORT}${stream.wsPath}` } });
  } catch (error) {
    console.error('[API] Error al obtener WS stream:', error);
    res.status(500).json({ error: 'Error al obtener WS stream', message: error.message });
  }
});

/**
 * DELETE /api/ws-streams/:id
 * Stop a WebSocket stream.
 */
app.delete('/api/ws-streams/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!webSocketManager.isStreamActive(id)) {
      return res.status(404).json({ error: 'WS stream no encontrado o no está activo' });
    }
    await webSocketManager.stopStream(id);
    res.json({ success: true, message: `WS stream ${id} detenido correctamente` });
  } catch (error) {
    console.error('[API] Error al detener WS stream:', error);
    res.status(500).json({ error: 'Error al detener WS stream', message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// 📡 CAMERA DISCOVERY ENDPOINTS
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/discovery/start
 * Inicia el descubrimiento de cámaras en la red local
 * Body: { tapoEmail?: string, tapoPassword?: string, scanRtsp?: boolean }
 */
app.post('/api/discovery/start', async (req, res) => {
  try {
    const { tapoEmail, tapoPassword, scanRtsp = true } = req.body;

    console.log('[API] Iniciando descubrimiento de cámaras...');

    // Iniciar descubrimiento de forma asíncrona
    cameraDiscovery.startDiscovery({
      tapoEmail,
      tapoPassword,
      scanRtsp
    }).catch(error => {
      console.error('[API] Error en descubrimiento:', error);
    });

    res.json({
      success: true,
      message: 'Descubrimiento iniciado',
      status: cameraDiscovery.getDiscoveryStatus()
    });
  } catch (error) {
    console.error('[API] Error al iniciar descubrimiento:', error);
    res.status(500).json({
      error: 'Error al iniciar descubrimiento',
      message: error.message
    });
  }
});

/**
 * GET /api/discovery/status
 * Obtiene el estado actual del descubrimiento
 */
app.get('/api/discovery/status', (req, res) => {
  try {
    const status = cameraDiscovery.getDiscoveryStatus();

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('[API] Error al obtener estado:', error);
    res.status(500).json({
      error: 'Error al obtener estado',
      message: error.message
    });
  }
});

/**
 * GET /api/discovery/devices
 * Obtiene la lista de dispositivos descubiertos
 */
app.get('/api/discovery/devices', (req, res) => {
  try {
    const devices = cameraDiscovery.getDiscoveredDevices();

    res.json({
      success: true,
      count: devices.length,
      devices
    });
  } catch (error) {
    console.error('[API] Error al obtener dispositivos:', error);
    res.status(500).json({
      error: 'Error al obtener dispositivos',
      message: error.message
    });
  }
});

/**
 * POST /api/discovery/test
 * Prueba la conexión a una cámara con credenciales
 * Body: { camera: object, credentials: { username, password } }
 */
app.post('/api/discovery/test', async (req, res) => {
  try {
    const { camera, credentials } = req.body;

    if (!camera) {
      return res.status(400).json({
        error: 'Se requiere el objeto camera'
      });
    }

    console.log(`[API] Probando conexión a cámara ${camera.name || camera.id}`);

    const result = await cameraDiscovery.testCameraConnection(camera, credentials);

    res.json({
      success: result.success,
      ...result
    });
  } catch (error) {
    console.error('[API] Error al probar conexión:', error);
    res.status(500).json({
      error: 'Error al probar conexión',
      message: error.message
    });
  }
});

/**
 * POST /api/discovery/rtsp-urls
 * Genera URLs RTSP sugeridas para una cámara
 * Body: { camera: object, credentials?: { username, password } }
 */
app.post('/api/discovery/rtsp-urls', (req, res) => {
  try {
    const { camera, credentials = {} } = req.body;

    if (!camera) {
      return res.status(400).json({
        error: 'Se requiere el objeto camera'
      });
    }

    const urls = cameraDiscovery.generateRtspUrls(camera, credentials);

    res.json({
      success: true,
      camera: camera.name || camera.id,
      urls
    });
  } catch (error) {
    console.error('[API] Error al generar URLs:', error);
    res.status(500).json({
      error: 'Error al generar URLs',
      message: error.message
    });
  }
});

/**
 * DELETE /api/discovery/clear
 * Limpia los dispositivos descubiertos
 */
app.delete('/api/discovery/clear', (req, res) => {
  try {
    cameraDiscovery.clearDiscoveredDevices();

    res.json({
      success: true,
      message: 'Dispositivos descubiertos eliminados'
    });
  } catch (error) {
    console.error('[API] Error al limpiar dispositivos:', error);
    res.status(500).json({
      error: 'Error al limpiar dispositivos',
      message: error.message
    });
  }
});

// Manejo de shutdown graceful
process.on('SIGTERM', async () => {
  console.log('\n[Server] SIGTERM recibido, cerrando servidor...');
  await streamManager.stopAllStreams();
  await webSocketManager.stopAllStreams();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n[Server] SIGINT recibido, cerrando servidor...');
  await streamManager.stopAllStreams();
  await webSocketManager.stopAllStreams();
  process.exit(0);
});

// Crear servidor HTTP explícito para soportar WebSocket upgrades
const httpServer = http.createServer(app);

// Registrar el handler de upgrades WebSocket
webSocketManager.attachToHttpServer(httpServer);

// Iniciar servidor
httpServer.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║    🎥 RTSP Web Player - Backend Server                ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`✅ Servidor corriendo en: http://localhost:${PORT}`);
  console.log('');
  console.log('📡 Endpoints - HLS Streams:');
  console.log(`   GET    /api/health          - Health check`);
  console.log(`   GET    /api/streams         - Listar streams HLS activos`);
  console.log(`   POST   /api/streams         - Iniciar nuevo stream HLS`);
  console.log(`   GET    /api/streams/:id     - Info de stream HLS específico`);
  console.log(`   DELETE /api/streams/:id     - Detener stream HLS`);
  console.log('');
  console.log('🔌 Endpoints - WebSocket Streams (baja latencia):');
  console.log(`   GET    /api/ws-streams         - Listar WS streams activos`);
  console.log(`   POST   /api/ws-streams         - Iniciar nuevo WS stream`);
  console.log(`   GET    /api/ws-streams/:id     - Info de WS stream específico`);
  console.log(`   DELETE /api/ws-streams/:id     - Detener WS stream`);
  console.log(`   WS     /api/ws-streams/:id/live - Conectar al stream en vivo`);
  console.log('');
  console.log('🔍 Endpoints - Camera Discovery:');
  console.log(`   POST   /api/discovery/start     - Iniciar descubrimiento`);
  console.log(`   GET    /api/discovery/status    - Estado del descubrimiento`);
  console.log(`   GET    /api/discovery/devices   - Dispositivos encontrados`);
  console.log(`   POST   /api/discovery/test      - Probar conexión a cámara`);
  console.log(`   POST   /api/discovery/rtsp-urls - Generar URLs RTSP`);
  console.log(`   DELETE /api/discovery/clear     - Limpiar dispositivos`);
  console.log('');
  console.log('🎬 Directorio de streams: ./server/streams/');
  console.log('');
  console.log('💡 Ejemplo de uso:');
  console.log('   curl -X POST http://localhost:3001/api/discovery/start');
  console.log('');
  console.log('⌨️  Presiona Ctrl+C para detener el servidor');
  console.log('════════════════════════════════════════════════════════');
});
