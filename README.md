# RTSP Web Player

Una aplicación web moderna para reproducir múltiples streams RTSP simultáneamente en tu navegador.

![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-blue)
![Vite](https://img.shields.io/badge/Vite-6-purple)

## Características

- ✅ **Conversión RTSP integrada** - Backend Node.js con FFmpeg para convertir RTSP a HLS en runtime
- ✅ Reproduce múltiples cámaras simultáneamente
- ✅ Soporte para HLS, MJPEG y WebRTC
- ✅ Almacenamiento automático en localStorage
- ✅ Diseño responsive con grid personalizable (1, 2 o 3 columnas)
- ✅ Interfaz moderna y oscura con Tailwind CSS
- ✅ Agregar/eliminar cámaras fácilmente
- ✅ TypeScript para mayor seguridad de tipos
- ✅ API REST para gestión de streams

## Instalación

### Requisitos Previos

- **Node.js 18+** (para el backend)
- **FFmpeg** (para conversión RTSP a HLS)

#### Instalar FFmpeg

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Windows:**
Descarga desde [ffmpeg.org](https://ffmpeg.org/download.html) y agrega al PATH.

### Instalación Rápida

```bash
# Instalar todas las dependencias (frontend + backend)
npm run setup

# O manualmente:
npm install                    # Frontend
npm run server:install         # Backend
```

### Iniciar la Aplicación

Necesitas ejecutar **dos terminales** simultáneamente:

**Terminal 1 - Backend (servidor de conversión RTSP):**
```bash
npm run server
```

**Terminal 2 - Frontend (interfaz web):**
```bash
npm run dev
```

Ahora abre tu navegador en `http://localhost:5173`

## Uso

1. **Iniciar la aplicación**: Ejecuta `npm run dev` o `bun run dev`
2. **Agregar cámara**: Haz clic en el botón `+` flotante
3. **Configurar cámara**:
   - Nombre: Un nombre descriptivo para tu cámara
   - URL: La URL del stream (ver sección de configuración RTSP)
   - Tipo: Selecciona el tipo de stream (HLS, RTSP, MJPEG, WebRTC)
4. **Gestionar vista**: Usa los botones de grid en la parte superior para cambiar el layout

## Configuración RTSP

Los navegadores web **NO** pueden reproducir streams RTSP directamente. Esta aplicación incluye un **backend integrado** que convierte automáticamente tus streams RTSP a HLS usando FFmpeg.

### ⭐ Opción 1: Backend Integrado (Recomendado)

La forma más fácil de usar streams RTSP es con el backend integrado:

1. **Inicia el backend** (si no lo has hecho):
   ```bash
   npm run server
   ```

2. **Agrega tu cámara RTSP** en la interfaz web:
   - URL: `rtsp://usuario:password@192.168.1.100:554/stream`
   - La conversión a HLS se hará **automáticamente**
   - El checkbox "Convertir automáticamente usando el backend" debe estar marcado

3. **¡Listo!** El backend convertirá el stream en tiempo real

#### Cómo Funciona

```
Tu Cámara RTSP → Backend (FFmpeg) → Conversión HLS → Navegador
```

El backend:
- Recibe la URL RTSP de tu cámara
- Usa FFmpeg para convertir a HLS en tiempo real
- Sirve los archivos HLS (.m3u8 y .ts)
- El frontend los reproduce automáticamente

#### API del Backend

El backend expone una API REST en `http://localhost:3001`:

**Iniciar stream:**
```bash
curl -X POST http://localhost:3001/api/streams \
  -H "Content-Type: application/json" \
  -d '{"id":"cam1","rtspUrl":"rtsp://..."}'
```

**Listar streams activos:**
```bash
curl http://localhost:3001/api/streams
```

**Detener stream:**
```bash
curl -X DELETE http://localhost:3001/api/streams/cam1
```

**Health check:**
```bash
curl http://localhost:3001/api/health
```

### Opción 2: FFmpeg Manual + HLS

Convierte tu stream RTSP a HLS usando FFmpeg:

```bash
ffmpeg -rtsp_transport tcp -i rtsp://usuario:password@192.168.1.100:554/stream \
  -c:v copy -c:a copy -f hls -hls_time 2 -hls_list_size 3 \
  -hls_flags delete_segments stream.m3u8
```

Luego sirve los archivos con un servidor HTTP simple:

```bash
# Con Python
python -m http.server 8080

# Con Node.js
npx serve .
```

Usa la URL: `http://localhost:8080/stream.m3u8`

### Opción 3: MediaMTX

[MediaMTX](https://github.com/bluenviron/mediamtx) es un servidor de streaming que convierte RTSP a HLS/WebRTC automáticamente.

```bash
# Descargar y ejecutar MediaMTX
wget https://github.com/bluenviron/mediamtx/releases/latest/download/mediamtx_linux_amd64.tar.gz
tar -xzf mediamtx_linux_amd64.tar.gz
./mediamtx
```

Configuración básica en `mediamtx.yml`:

```yaml
paths:
  cam1:
    source: rtsp://usuario:password@192.168.1.100:554/stream
```

URL para usar: `http://localhost:8889/cam1/index.m3u8`

### Opción 4: go2rtc

[go2rtc](https://github.com/AlexxIT/go2rtc) soporta múltiples protocolos y es muy eficiente.

```bash
# Instalar go2rtc
docker run -p 1984:1984 -p 8554:8554 alexxit/go2rtc
```

Configurar en `go2rtc.yaml`:

```yaml
streams:
  camera1: rtsp://usuario:password@192.168.1.100:554/stream
```

URL para WebRTC: `http://localhost:1984/`

### Opción 5: Cámaras IP con MJPEG

Algunas cámaras IP soportan MJPEG directamente:

```
http://192.168.1.100/video.cgi
http://192.168.1.100/videostream.cgi
```

## Formatos Soportados

| Formato | Extensión | Descripción | Latencia |
|---------|-----------|-------------|----------|
| HLS | .m3u8 | HTTP Live Streaming (más compatible) | Media (5-10s) |
| MJPEG | .mjpeg, .cgi | Motion JPEG sobre HTTP | Baja (< 1s) |
| WebRTC | N/A | Streaming en tiempo real | Muy baja (< 500ms) |
| RTSP | rtsp:// | Requiere conversión a HLS/WebRTC | N/A |

## Ejemplos de URLs

```javascript
// HLS desde servidor local
http://localhost:8080/camera1/stream.m3u8

// MJPEG desde cámara IP
http://192.168.1.100/videostream.cgi

// HLS desde MediaMTX
http://localhost:8889/cam1/index.m3u8

// Big Buck Bunny (demo HLS)
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
```

## Estructura del Proyecto

```
rtsp-web-player/
├── src/                           # Frontend (React + TypeScript)
│   ├── components/
│   │   ├── VideoPlayer.tsx       # Componente de reproductor individual
│   │   └── AddCameraForm.tsx     # Formulario para agregar cámaras
│   ├── hooks/
│   │   └── useLocalStorage.ts    # Hook para persistencia
│   ├── types.ts                  # Tipos TypeScript
│   ├── App.tsx                   # Componente principal
│   └── main.tsx                  # Punto de entrada
├── server/                        # Backend (Node.js + Express)
│   ├── index.js                  # Servidor Express + API REST
│   ├── streamManager.js          # Gestor de conversión RTSP → HLS
│   ├── streams/                  # Archivos HLS generados (auto-creado)
│   └── package.json              # Dependencias del backend
├── package.json                   # Dependencias del frontend
├── tsconfig.json
└── tailwind.config.js
```

## Scripts Disponibles

```bash
# Instalación
npm run setup              # Instala dependencias del frontend y backend

# Desarrollo
npm run dev                # Inicia servidor de desarrollo (frontend)
npm run server             # Inicia backend de conversión RTSP
npm run server:install     # Instala solo dependencias del backend

# Producción
npm run build              # Construye para producción
npm run preview            # Preview de build de producción

# Linting
npm run lint               # Ejecuta ESLint
```

## Tecnologías Utilizadas

### Frontend
- **React 18** - Librería UI
- **TypeScript** - Lenguaje tipado
- **Vite** - Build tool y dev server
- **Tailwind CSS** - Framework CSS utility-first
- **HLS.js** - Reproductor HLS para navegadores
- **Lucide React** - Iconos modernos

### Backend
- **Node.js** - Runtime JavaScript
- **Express** - Framework web minimalista
- **FFmpeg** - Conversión de video RTSP → HLS
- **fluent-ffmpeg** - Wrapper de FFmpeg para Node.js
- **CORS** - Manejo de CORS para API REST

## Solución de Problemas

### Error: "HLS no soportado en este navegador"

- Asegúrate de usar un navegador moderno (Chrome, Firefox, Edge)
- Safari tiene soporte nativo para HLS

### El video no se carga

1. **Verifica que el backend esté corriendo:**
   ```bash
   npm run server
   ```
   Deberías ver: `✅ Servidor corriendo en: http://localhost:3001`

2. **Verifica FFmpeg:**
   ```bash
   ffmpeg -version
   ```
   Si no está instalado, instálalo según tu sistema operativo.

3. **Verifica la URL RTSP:**
   - Asegúrate de que la cámara sea accesible en tu red
   - Prueba la URL con VLC o similar primero
   - Formato: `rtsp://usuario:password@IP:puerto/stream`

4. **Revisa los logs:**
   - Consola del navegador (F12)
   - Terminal donde corre el backend

5. **Verifica CORS:**
   - El backend ya incluye CORS habilitado
   - Si usas otro servidor, configura CORS adecuadamente

### Alta latencia en el stream

- Usa WebRTC para menor latencia
- Reduce el `hls_time` en FFmpeg (ej: `-hls_time 1`)
- Considera usar go2rtc con WebRTC

### CORS errors

Si estás sirviendo HLS desde otro dominio, necesitas configurar CORS:

```javascript
// Ejemplo con Express
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});
```

## Seguridad

- Las URLs con credenciales se almacenan en localStorage del navegador
- No expongas esta aplicación públicamente sin autenticación
- Usa HTTPS en producción
- Considera usar variables de entorno para credenciales

## Roadmap

- [x] Backend integrado para conversión RTSP → HLS
- [x] API REST para gestión de streams
- [ ] Detener streams automáticamente cuando se elimina la cámara
- [ ] Interfaz de administración de streams activos
- [ ] Soporte para WebRTC nativo (baja latencia)
- [ ] Grabación de streams
- [ ] Detección de movimiento
- [ ] Vista de pantalla completa
- [ ] Snapshots/Capturas
- [ ] Mejoras en soporte de audio
- [ ] Layouts predefinidos (2x2, 3x3, etc)
- [ ] Exportar/importar configuración
- [ ] Dashboard con estadísticas de streams
- [ ] Notificaciones en tiempo real

## Contribuir

Las contribuciones son bienvenidas! Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia

MIT License - ve el archivo [LICENSE](LICENSE) para más detalles.

## Soporte

¿Tienes preguntas o problemas?

- Abre un issue en GitHub
- Revisa la sección de [Solución de Problemas](#solución-de-problemas)

---

Hecho con ❤️ usando React + TypeScript + Tailwind CSS
