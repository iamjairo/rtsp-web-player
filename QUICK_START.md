# Inicio Rápido - RTSP Web Player

## Requisitos previos

1. **Node.js 18+** instalado
2. **FFmpeg** instalado

### Verificar instalación:

```bash
node --version  # Debe mostrar v18 o superior
ffmpeg -version # Debe mostrar la versión de FFmpeg
```

### Si no tienes FFmpeg:

**Linux (Ubuntu/Debian):**
```bash
sudo apt update && sudo apt install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Windows:**
Descarga desde [ffmpeg.org](https://ffmpeg.org/download.html)

---

## Instalación (3 pasos)

### 1. Instalar dependencias

```bash
npm run setup
```

Este comando instala:
- Dependencias del frontend (React, TypeScript, Vite, etc.)
- Dependencias del backend (Express, FFmpeg wrapper, etc.)

### 2. Iniciar el backend (Terminal 1)

```bash
npm run server
```

Deberías ver:
```
╔════════════════════════════════════════════════════════╗
║    🎥 RTSP Web Player - Backend Server                ║
╚════════════════════════════════════════════════════════╝

✅ Servidor corriendo en: http://localhost:3001
```

**¡Deja esta terminal abierta!**

### 3. Iniciar el frontend (Terminal 2)

```bash
npm run dev
```

Deberías ver:
```
VITE v7.x.x  ready in XXX ms

➜  Local:   http://localhost:5173/
```

Abre tu navegador en **http://localhost:5173**

---

## Agregar tu cámara RTSP

1. **Haz clic en el botón `+`** (esquina inferior derecha)

2. **Completa el formulario:**
   - **Nombre:** Mi Cámara de Seguridad
   - **URL:** `rtsp://usuario:password@192.168.1.100:554/stream`
   - **Conversión automática:** ✓ Debe estar marcado

3. **Haz clic en "Agregar"**

4. **¡Listo!** El backend convertirá automáticamente tu stream RTSP a HLS

---

## Formato de URL RTSP

```
rtsp://[usuario]:[password]@[IP]:[puerto]/[ruta]
```

### Ejemplos:

```
rtsp://admin:12345@192.168.1.100:554/stream1
rtsp://user:pass@10.0.0.50:8554/live
rtsp://192.168.0.20:554/h264  (sin autenticación)
```

### Encontrar tu URL RTSP:

1. **Consulta el manual de tu cámara** - Busca "RTSP URL" o "Streaming URL"
2. **Aplicación del fabricante** - Revisa la configuración de la cámara
3. **Prueba en VLC:**
   - Abre VLC → Media → Open Network Stream
   - Ingresa la URL RTSP
   - Si funciona en VLC, funcionará aquí

---

## Solución rápida de problemas

### ❌ El video no carga

1. **¿El backend está corriendo?**
   ```bash
   # Terminal 1 debe mostrar:
   ✅ Servidor corriendo en: http://localhost:3001
   ```

2. **¿FFmpeg está instalado?**
   ```bash
   ffmpeg -version
   ```

3. **¿La URL RTSP es correcta?**
   - Pruébala en VLC primero
   - Verifica usuario, password, IP y puerto

4. **Revisa los logs:**
   - Consola del navegador (F12)
   - Terminal del backend

### ❌ Error: "Cannot connect to backend"

El backend no está corriendo. Ejecuta:
```bash
npm run server
```

### ❌ Error: "FFmpeg not found"

FFmpeg no está instalado o no está en el PATH. Instálalo según tu sistema operativo.

---

## Comandos útiles

```bash
# Ver streams activos en el backend
curl http://localhost:3001/api/streams

# Detener un stream específico
curl -X DELETE http://localhost:3001/api/streams/cam_12345

# Health check del backend
curl http://localhost:3001/api/health
```

---

## Próximos pasos

- **Múltiples cámaras:** Agrega varias cámaras usando el botón `+`
- **Cambiar layout:** Usa los botones de grid (1, 2 o 3 columnas)
- **Eliminar cámara:** Haz clic en el ícono de basura en cada cámara

---

## ¿Necesitas ayuda?

- 📖 Lee el [README.md](README.md) completo para más opciones
- 🐛 Reporta problemas en GitHub Issues
- 💬 Revisa la sección de [Solución de Problemas](README.md#solución-de-problemas)

---

**¡Disfruta viendo tus cámaras! 🎥**
