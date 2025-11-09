import ffmpeg from 'fluent-ffmpeg';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class StreamManager {
  constructor() {
    this.activeStreams = new Map();
    this.streamsDir = path.join(__dirname, 'streams');

    // Asegurar que el directorio de streams existe
    if (!fs.existsSync(this.streamsDir)) {
      fs.mkdirSync(this.streamsDir, { recursive: true });
    }
  }

  /**
   * Inicia la conversión de un stream RTSP a HLS
   * @param {string} streamId - ID único del stream
   * @param {string} rtspUrl - URL RTSP de la cámara
   * @returns {Promise<string>} - URL del stream HLS generado
   */
  async startStream(streamId, rtspUrl) {
    // Si ya existe un stream con este ID, detenerlo primero
    if (this.activeStreams.has(streamId)) {
      await this.stopStream(streamId);
    }

    const streamDir = path.join(this.streamsDir, streamId);

    // Crear directorio para este stream
    if (!fs.existsSync(streamDir)) {
      fs.mkdirSync(streamDir, { recursive: true });
    }

    const outputPath = path.join(streamDir, 'index.m3u8');

    return new Promise((resolve, reject) => {
      console.log(`[StreamManager] Iniciando conversión RTSP -> HLS para: ${streamId}`);
      console.log(`[StreamManager] RTSP URL: ${rtspUrl}`);
      console.log(`[StreamManager] Output: ${outputPath}`);

      // Usar spawn directamente para tener más control
      const ffmpegProcess = spawn('ffmpeg', [
        '-rtsp_transport', 'tcp',
        '-i', rtspUrl,
        '-c:v', 'copy',           // Copiar codec de video (sin recodificar)
        '-c:a', 'aac',             // Codificar audio a AAC
        '-b:a', '128k',            // Bitrate de audio
        '-f', 'hls',               // Formato HLS
        '-hls_time', '2',          // Duración de cada segmento (2 segundos)
        '-hls_list_size', '5',     // Mantener últimos 5 segmentos en playlist
        '-hls_flags', 'delete_segments+append_list', // Eliminar segmentos antiguos
        '-hls_segment_filename', path.join(streamDir, 'segment_%03d.ts'),
        '-start_number', '0',      // Comenzar numeración en 0
        outputPath
      ]);

      let isResolved = false;

      ffmpegProcess.stdout.on('data', (data) => {
        console.log(`[FFmpeg ${streamId}] stdout: ${data}`);
      });

      ffmpegProcess.stderr.on('data', (data) => {
        const message = data.toString();

        // FFmpeg envía la mayoría de logs a stderr
        if (message.includes('Opening') || message.includes('Input #0')) {
          console.log(`[FFmpeg ${streamId}] ${message.trim()}`);
        }

        // Detectar cuando el primer segmento está listo
        // IMPORTANTE: Verificar que el mensaje sea específico de ESTE stream (incluya el streamId en el path)
        if (!isResolved && message.includes(streamId) &&
            (message.includes('segment_000.ts') || message.includes('index.m3u8'))) {
          // Esperar un poco para asegurar que el archivo m3u8 esté disponible
          setTimeout(() => {
            if (!isResolved && fs.existsSync(outputPath)) {
              isResolved = true;
              const hlsUrl = `/streams/${streamId}/index.m3u8`;
              console.log(`[StreamManager] Stream ${streamId} iniciado exitosamente: ${hlsUrl}`);
              resolve(hlsUrl);
            }
          }, 1000);
        }

        // Detectar errores
        if (message.toLowerCase().includes('error')) {
          console.error(`[FFmpeg ${streamId}] Error: ${message.trim()}`);
        }
      });

      ffmpegProcess.on('error', (error) => {
        console.error(`[StreamManager] Error al iniciar FFmpeg para ${streamId}:`, error);
        if (!isResolved) {
          isResolved = true;
          reject(new Error(`Error al iniciar FFmpeg: ${error.message}`));
        }
      });

      ffmpegProcess.on('close', (code) => {
        console.log(`[StreamManager] FFmpeg proceso cerrado para ${streamId} con código: ${code}`);
        this.activeStreams.delete(streamId);

        if (code !== 0 && !isResolved) {
          isResolved = true;
          reject(new Error(`FFmpeg terminó con código de error: ${code}`));
        }
      });

      // Guardar referencia al proceso
      this.activeStreams.set(streamId, {
        process: ffmpegProcess,
        rtspUrl,
        startTime: Date.now(),
        outputPath
      });

      // Verificación periódica del archivo m3u8 como fallback
      // Útil cuando hay múltiples streams y los logs pueden mezclarse
      const checkInterval = setInterval(() => {
        if (isResolved) {
          clearInterval(checkInterval);
          return;
        }

        // Verificar si el archivo m3u8 ya existe
        if (fs.existsSync(outputPath)) {
          clearInterval(checkInterval);
          if (!isResolved) {
            isResolved = true;
            const hlsUrl = `/streams/${streamId}/index.m3u8`;
            console.log(`[StreamManager] Stream ${streamId} iniciado exitosamente (detectado por verificación periódica): ${hlsUrl}`);
            resolve(hlsUrl);
          }
        }
      }, 1000); // Verificar cada segundo

      // Timeout de seguridad - si no se resuelve en 30 segundos, rechazar
      // Aumentado a 30s para permitir múltiples streams simultáneos
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!isResolved) {
          isResolved = true;
          reject(new Error('Timeout al iniciar stream - verifica la URL RTSP y que FFmpeg tenga recursos suficientes'));
        }
      }, 30000);
    });
  }

  /**
   * Detiene un stream activo
   * @param {string} streamId - ID del stream a detener
   */
  async stopStream(streamId) {
    const stream = this.activeStreams.get(streamId);

    if (!stream) {
      console.log(`[StreamManager] Stream ${streamId} no está activo`);
      return;
    }

    console.log(`[StreamManager] Deteniendo stream: ${streamId}`);

    // Enviar señal SIGTERM para terminar gracefully
    stream.process.kill('SIGTERM');

    // Si no termina en 5 segundos, forzar con SIGKILL
    setTimeout(() => {
      if (this.activeStreams.has(streamId)) {
        console.log(`[StreamManager] Forzando cierre de stream: ${streamId}`);
        stream.process.kill('SIGKILL');
      }
    }, 5000);

    this.activeStreams.delete(streamId);

    // Limpiar archivos del stream
    const streamDir = path.join(this.streamsDir, streamId);
    if (fs.existsSync(streamDir)) {
      try {
        fs.rmSync(streamDir, { recursive: true, force: true });
        console.log(`[StreamManager] Archivos eliminados para stream: ${streamId}`);
      } catch (error) {
        console.error(`[StreamManager] Error al eliminar archivos para ${streamId}:`, error);
      }
    }
  }

  /**
   * Obtiene la lista de streams activos
   * @returns {Array} - Lista de streams activos
   */
  getActiveStreams() {
    const streams = [];

    this.activeStreams.forEach((stream, streamId) => {
      streams.push({
        id: streamId,
        rtspUrl: stream.rtspUrl,
        hlsUrl: `/streams/${streamId}/index.m3u8`,
        startTime: stream.startTime,
        uptime: Date.now() - stream.startTime
      });
    });

    return streams;
  }

  /**
   * Detiene todos los streams activos
   */
  async stopAllStreams() {
    console.log('[StreamManager] Deteniendo todos los streams...');
    const promises = Array.from(this.activeStreams.keys()).map(streamId =>
      this.stopStream(streamId)
    );
    await Promise.all(promises);
    console.log('[StreamManager] Todos los streams detenidos');
  }

  /**
   * Verifica si un stream está activo
   * @param {string} streamId - ID del stream
   * @returns {boolean}
   */
  isStreamActive(streamId) {
    return this.activeStreams.has(streamId);
  }
}

// Singleton instance
const streamManager = new StreamManager();

export default streamManager;
