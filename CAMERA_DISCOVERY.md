# Descubrimiento Automático de Cámaras

Esta funcionalidad permite descubrir automáticamente cámaras IP en tu red local, incluyendo:
- Cámaras compatibles con ONVIF (estándar de la industria)
- Cámaras Tapo de TP-Link
- Cámaras Yi de Xiaomi
- Cualquier dispositivo con RTSP genérico

## Características Principales

### 1. Descubrimiento Automático
- **ONVIF Discovery**: Detecta automáticamente cámaras compatibles con ONVIF en la red local
- **Tapo Discovery**: Descubre cámaras Tapo usando tus credenciales de cuenta TP-Link
- **Escaneo de Puertos RTSP**: Busca puertos RTSP comunes en dispositivos descubiertos

### 2. Autenticación
- Soporte para autenticación con usuario y contraseña
- Prueba de conexión antes de agregar la cámara
- Generación automática de URLs RTSP según el tipo de cámara

### 3. Interfaz Intuitiva
- Modal de descubrimiento integrado en la aplicación
- Barra de progreso en tiempo real
- Lista de dispositivos encontrados con información detallada
- Conexión rápida con un solo clic

## Cómo Usar

### Opción 1: Descubrimiento Básico (ONVIF)

1. Abre la aplicación RTSP Web Player
2. Haz clic en el botón **"Descubrir Cámaras"** en el header
3. Haz clic en **"Iniciar Descubrimiento"**
4. Espera mientras el sistema busca dispositivos (aproximadamente 10-15 segundos)
5. Selecciona la cámara que deseas agregar
6. Ingresa las credenciales de la cámara (usuario y contraseña)
7. Haz clic en **"Probar Conexión"**
8. Si la conexión es exitosa, selecciona una de las URLs RTSP generadas
9. La cámara se agregará automáticamente al grid de visualización

### Opción 2: Descubrimiento de Cámaras Tapo

1. Abre el modal de descubrimiento
2. Haz clic en **"Credenciales Tapo"**
3. Ingresa tu email y contraseña de la cuenta TP-Link
4. Haz clic en **"Iniciar Descubrimiento"**
5. El sistema descubrirá todas tus cámaras Tapo registradas en la cuenta
6. Sigue los pasos 5-9 de la opción anterior

## Tipos de Cámaras Soportadas

### ONVIF (Estándar Universal)
- Marcas soportadas: Axis, Bosch, Canon, Hanwha, HikVision, Panasonic, Sony y más
- Requiere que la cámara tenga ONVIF habilitado
- Proporciona múltiples perfiles de streaming
- Información automática del dispositivo

### Tapo (TP-Link)
- Modelos soportados: C100, C200, C310, C320WS y más
- Requiere cuenta TP-Link
- Descubrimiento basado en la nube
- URLs RTSP pre-configuradas

### Yi Cams (Xiaomi)
- Soporte para modelos Yi Home
- Descubrimiento manual por ahora
- URLs RTSP estándar para Yi Cams

## API REST para Desarrolladores

El backend expone los siguientes endpoints:

### 1. Iniciar Descubrimiento
```bash
POST /api/discovery/start
Content-Type: application/json

{
  "tapoEmail": "tu-email@ejemplo.com",      # Opcional
  "tapoPassword": "tu-contraseña",           # Opcional
  "scanRtsp": true                           # Opcional, default: true
}
```

### 2. Obtener Estado del Descubrimiento
```bash
GET /api/discovery/status

Response:
{
  "success": true,
  "status": "running|completed|error|idle",
  "progress": 50,
  "message": "Buscando cámaras ONVIF...",
  "devicesFound": 3,
  "inProgress": true
}
```

### 3. Obtener Dispositivos Descubiertos
```bash
GET /api/discovery/devices

Response:
{
  "success": true,
  "count": 3,
  "devices": [
    {
      "id": "onvif-xxx",
      "type": "onvif",
      "name": "Camera 1",
      "manufacturer": "HikVision",
      "model": "DS-2CD2xxx",
      "ip": "192.168.1.100",
      "requiresAuth": true,
      "rtspPorts": [554, 8554]
    }
  ]
}
```

### 4. Probar Conexión a Cámara
```bash
POST /api/discovery/test
Content-Type: application/json

{
  "camera": { /* objeto de cámara descubierta */ },
  "credentials": {
    "username": "admin",
    "password": "contraseña123"
  }
}

Response:
{
  "success": true,
  "deviceInfo": { /* información del dispositivo */ },
  "profiles": [
    {
      "profile": "MainStream",
      "uri": "rtsp://192.168.1.100:554/stream1",
      "resolution": { "width": 1920, "height": 1080 }
    }
  ]
}
```

### 5. Generar URLs RTSP
```bash
POST /api/discovery/rtsp-urls
Content-Type: application/json

{
  "camera": { /* objeto de cámara descubierta */ },
  "credentials": {
    "username": "admin",
    "password": "contraseña123"
  }
}

Response:
{
  "success": true,
  "camera": "Camera 1",
  "urls": [
    "rtsp://admin:contraseña123@192.168.1.100:554/stream1",
    "rtsp://admin:contraseña123@192.168.1.100:554/stream2",
    "rtsp://admin:contraseña123@192.168.1.100:554/live/main"
  ]
}
```

### 6. Limpiar Dispositivos Descubiertos
```bash
DELETE /api/discovery/clear

Response:
{
  "success": true,
  "message": "Dispositivos descubiertos eliminados"
}
```

## Estructura de Datos

### DiscoveredCamera
```typescript
interface DiscoveredCamera {
  id: string;                          // ID único
  type: 'onvif' | 'tapo' | 'yi' | 'generic';
  name: string;                        // Nombre de la cámara
  manufacturer?: string;               // Fabricante
  model?: string;                      // Modelo
  ip?: string;                         // Dirección IP
  address?: string;                    // Dirección completa
  port?: number;                       // Puerto principal
  onvifAddress?: string;               // URL ONVIF
  deviceId?: string;                   // ID del dispositivo (Tapo)
  macAddress?: string;                 // Dirección MAC
  firmwareVersion?: string;            // Versión del firmware
  requiresAuth: boolean;               // Si requiere autenticación
  rtspPorts?: number[];                // Puertos RTSP disponibles
  discovered: string;                  // Timestamp de descubrimiento
  cloudConnected?: boolean;            // Estado de conexión a la nube
}
```

## Solución de Problemas

### No se encuentran dispositivos
1. Verifica que las cámaras estén encendidas y en la misma red
2. Asegúrate de que ONVIF esté habilitado en las cámaras (si aplica)
3. Verifica que no haya firewalls bloqueando el descubrimiento
4. Para Tapo: verifica que las credenciales sean correctas

### Error de autenticación
1. Verifica que el usuario y contraseña sean correctos
2. Algunos dispositivos tienen usuarios predeterminados (admin, root, etc.)
3. Verifica que la cámara no esté bloqueada por múltiples intentos fallidos

### La URL RTSP no funciona
1. Prueba con diferentes URLs sugeridas
2. Verifica que el puerto RTSP esté abierto
3. Algunos dispositivos requieren configuración adicional para habilitar RTSP

## Dependencias del Backend

Las siguientes librerías NPM se utilizan para el descubrimiento:

- `node-onvif`: Descubrimiento y control de cámaras ONVIF
- `tp-link-tapo-connect`: API no oficial para dispositivos Tapo
- `node-nmap`: Escaneo de red (uso futuro)
- `net`: Módulo nativo de Node.js para escaneo de puertos

## Seguridad

- Las credenciales se envían solo cuando el usuario las proporciona
- Las credenciales Tapo se usan temporalmente y no se almacenan
- Las URLs RTSP con credenciales se generan en el servidor
- Se recomienda usar HTTPS en producción para proteger las credenciales

## Limitaciones Actuales

1. **Yi Cams**: La implementación de descubrimiento automático está pendiente
2. **Escaneo de Red Completo**: Actualmente solo escanea dispositivos ONVIF descubiertos
3. **Credenciales Tapo**: Requiere cuenta TP-Link; no funciona con dispositivos locales sin cuenta
4. **Timeouts**: El descubrimiento tiene un timeout de 30 segundos

## Próximas Mejoras

- [ ] Implementar descubrimiento completo de Yi Cams
- [ ] Agregar escaneo completo de subred para RTSP genérico
- [ ] Soporte para más marcas de cámaras
- [ ] Almacenamiento seguro de credenciales
- [ ] Descubrimiento periódico en segundo plano
- [ ] Notificaciones cuando se detectan nuevos dispositivos

## Ejemplo de Flujo Completo

```bash
# 1. Iniciar descubrimiento
curl -X POST http://localhost:3001/api/discovery/start \
  -H "Content-Type: application/json" \
  -d '{}'

# 2. Verificar estado (polling cada segundo)
curl http://localhost:3001/api/discovery/status

# 3. Obtener dispositivos encontrados
curl http://localhost:3001/api/discovery/devices

# 4. Probar conexión con credenciales
curl -X POST http://localhost:3001/api/discovery/test \
  -H "Content-Type: application/json" \
  -d '{
    "camera": {
      "id": "onvif-xxx",
      "type": "onvif",
      "ip": "192.168.1.100",
      "onvifAddress": "http://192.168.1.100:80/onvif/device_service"
    },
    "credentials": {
      "username": "admin",
      "password": "password123"
    }
  }'

# 5. Agregar stream RTSP
curl -X POST http://localhost:3001/api/streams \
  -H "Content-Type: application/json" \
  -d '{
    "id": "camera-001",
    "rtspUrl": "rtsp://admin:password123@192.168.1.100:554/stream1"
  }'
```

## Contribuir

Si deseas agregar soporte para más tipos de cámaras o mejorar el descubrimiento, las contribuciones son bienvenidas. Los archivos principales son:

- `/server/cameraDiscovery.js` - Lógica de descubrimiento del backend
- `/src/components/CameraDiscovery.tsx` - Componente UI de React
- `/src/types.ts` - Definiciones de tipos TypeScript

---

**Nota**: Esta funcionalidad está en desarrollo activo. Reporta cualquier problema o sugerencia en el repositorio del proyecto.
