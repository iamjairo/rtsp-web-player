# RTSP Web Player

Una aplicación web moderna para reproducir múltiples streams RTSP simultáneamente en tu navegador.

![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-blue)
![Vite](https://img.shields.io/badge/Vite-6-purple)

## Características

- ✅ Reproduce múltiples cámaras simultáneamente
- ✅ Soporte para HLS, MJPEG y WebRTC
- ✅ Almacenamiento automático en localStorage
- ✅ Diseño responsive con grid personalizable (1, 2 o 3 columnas)
- ✅ Interfaz moderna y oscura con Tailwind CSS
- ✅ Agregar/eliminar cámaras fácilmente
- ✅ TypeScript para mayor seguridad de tipos

## Instalación

### Opción 1: Con npm

```bash
npm install
npm run dev
```

### Opción 2: Con Bun (Recomendado)

```bash
# Instalar Bun si no lo tienes
curl -fsSL https://bun.sh/install | bash

# Instalar dependencias y ejecutar
bun install
bun run dev
```

## Uso

1. **Iniciar la aplicación**: Ejecuta `npm run dev` o `bun run dev`
2. **Agregar cámara**: Haz clic en el botón `+` flotante
3. **Configurar cámara**:
   - Nombre: Un nombre descriptivo para tu cámara
   - URL: La URL del stream (ver sección de configuración RTSP)
   - Tipo: Selecciona el tipo de stream (HLS, RTSP, MJPEG, WebRTC)
4. **Gestionar vista**: Usa los botones de grid en la parte superior para cambiar el layout

## Configuración RTSP

Los navegadores web **NO** pueden reproducir streams RTSP directamente. Necesitas convertir el stream RTSP a un formato compatible con navegadores (HLS o WebRTC).

### Opción 1: FFmpeg + HLS

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

### Opción 2: MediaMTX (Recomendado)

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

### Opción 3: go2rtc

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

### Opción 4: Cámaras IP con MJPEG

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
├── src/
│   ├── components/
│   │   ├── VideoPlayer.tsx      # Componente de reproductor individual
│   │   └── AddCameraForm.tsx    # Formulario para agregar cámaras
│   ├── hooks/
│   │   └── useLocalStorage.ts   # Hook para persistencia
│   ├── types.ts                 # Tipos TypeScript
│   ├── App.tsx                  # Componente principal
│   └── main.tsx                 # Punto de entrada
├── package.json
├── tsconfig.json
└── tailwind.config.js
```

## Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Inicia servidor de desarrollo
bun run dev

# Producción
npm run build        # Construye para producción
npm run preview      # Preview de build de producción

# Linting
npm run lint         # Ejecuta ESLint
```

## Tecnologías Utilizadas

- **React 18** - Librería UI
- **TypeScript** - Lenguaje tipado
- **Vite** - Build tool y dev server
- **Tailwind CSS** - Framework CSS utility-first
- **HLS.js** - Reproductor HLS para navegadores
- **Lucide React** - Iconos modernos

## Solución de Problemas

### Error: "HLS no soportado en este navegador"

- Asegúrate de usar un navegador moderno (Chrome, Firefox, Edge)
- Safari tiene soporte nativo para HLS

### El video no se carga

1. Verifica que la URL sea correcta
2. Comprueba que el servidor RTSP/HLS esté ejecutándose
3. Revisa la consola del navegador para errores
4. Verifica que no haya problemas de CORS

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

- [ ] Soporte para WebRTC nativo
- [ ] Grabación de streams
- [ ] Detección de movimiento
- [ ] Vista de pantalla completa
- [ ] Snapshots/Capturas
- [ ] Soporte para audio
- [ ] Layouts predefinidos (2x2, 3x3, etc)
- [ ] Exportar/importar configuración

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
