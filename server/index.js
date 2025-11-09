import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import streamManager from './streamManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Servir archivos estáticos de streams HLS
app.use('/streams', express.static(path.join(__dirname, 'streams')));

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

    // Validar formato RTSP URL
    if (!rtspUrl.startsWith('rtsp://')) {
      return res.status(400).json({
        error: 'La URL debe comenzar con rtsp://'
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

// Manejo de shutdown graceful
process.on('SIGTERM', async () => {
  console.log('\n[Server] SIGTERM recibido, cerrando servidor...');
  await streamManager.stopAllStreams();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n[Server] SIGINT recibido, cerrando servidor...');
  await streamManager.stopAllStreams();
  process.exit(0);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║    🎥 RTSP Web Player - Backend Server                ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`✅ Servidor corriendo en: http://localhost:${PORT}`);
  console.log('');
  console.log('📡 Endpoints disponibles:');
  console.log(`   GET    /api/health          - Health check`);
  console.log(`   GET    /api/streams         - Listar streams activos`);
  console.log(`   POST   /api/streams         - Iniciar nuevo stream`);
  console.log(`   GET    /api/streams/:id     - Info de stream específico`);
  console.log(`   DELETE /api/streams/:id     - Detener stream`);
  console.log('');
  console.log('🎬 Directorio de streams: ./server/streams/');
  console.log('');
  console.log('💡 Ejemplo de uso:');
  console.log('   curl -X POST http://localhost:3001/api/streams \\');
  console.log('        -H "Content-Type: application/json" \\');
  console.log('        -d \'{"id":"cam1","rtspUrl":"rtsp://..."}\'');
  console.log('');
  console.log('⌨️  Presiona Ctrl+C para detener el servidor');
  console.log('════════════════════════════════════════════════════════');
});
