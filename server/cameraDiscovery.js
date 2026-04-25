import onvif from 'node-onvif';
import { cloudLogin, loginDevice } from 'tp-link-tapo-connect';
import net from 'net';
import os from 'os';

class CameraDiscovery {
  constructor() {
    this.discoveredDevices = [];
    this.discoveryInProgress = false;
    this.discoveryProgress = {
      status: 'idle',
      progress: 0,
      message: '',
      devicesFound: 0
    };
  }

  /**
   * Sanitiza un ID para usarlo en URLs y rutas de archivos
   */
  sanitizeId(id) {
    // Reemplaza caracteres problemáticos con guiones
    return id
      .replace(/[:/\\?#\[\]@!$&'()*+,;=]/g, '-') // Caracteres especiales de URL
      .replace(/\s+/g, '-') // Espacios
      .replace(/-+/g, '-') // Múltiples guiones consecutivos
      .replace(/^-|-$/g, ''); // Guiones al inicio o final
  }

  /**
   * Obtiene la información de red local
   */
  getLocalNetworkInfo() {
    const interfaces = os.networkInterfaces();
    const networks = [];

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Solo IPv4 y no loopback
        if (iface.family === 'IPv4' && !iface.internal) {
          networks.push({
            interface: name,
            address: iface.address,
            netmask: iface.netmask,
            cidr: iface.cidr
          });
        }
      }
    }

    return networks;
  }

  /**
   * Inicia el descubrimiento de cámaras en la red local
   */
  async startDiscovery(options = {}) {
    if (this.discoveryInProgress) {
      throw new Error('Discovery already in progress');
    }

    this.discoveryInProgress = true;
    this.discoveredDevices = [];
    this.discoveryProgress = {
      status: 'running',
      progress: 0,
      message: 'Iniciando descubrimiento...',
      devicesFound: 0
    };

    try {
      const networks = this.getLocalNetworkInfo();
      console.log(`[Discovery] Found ${networks.length} network interface(s)`);

      // Descubrimiento ONVIF (cámaras IP estándar)
      await this.discoverOnvifCameras();

      // Descubrimiento de cámaras Tapo (si se proveen credenciales)
      if (options.tapoEmail && options.tapoPassword) {
        await this.discoverTapoCameras(options.tapoEmail, options.tapoPassword);
      }

      // Escaneo de puertos RTSP comunes
      if (options.scanRtsp !== false) {
        await this.scanRtspPorts(networks);
      }

      this.discoveryProgress = {
        status: 'completed',
        progress: 100,
        message: `Descubrimiento completado. ${this.discoveredDevices.length} dispositivo(s) encontrado(s)`,
        devicesFound: this.discoveredDevices.length
      };

      return this.discoveredDevices;
    } catch (error) {
      console.error('[Discovery] Error:', error);
      this.discoveryProgress = {
        status: 'error',
        progress: 0,
        message: `Error: ${error.message}`,
        devicesFound: this.discoveredDevices.length
      };
      throw error;
    } finally {
      this.discoveryInProgress = false;
    }
  }

  /**
   * Descubre cámaras ONVIF en la red local
   */
  async discoverOnvifCameras() {
    return new Promise((resolve) => {
      console.log('[Discovery] Starting ONVIF discovery...');
      this.discoveryProgress.message = 'Buscando cámaras ONVIF...';
      this.discoveryProgress.progress = 10;

      const discoveryTimeout = setTimeout(() => {
        console.log('[Discovery] ONVIF discovery timeout (10s)');
        resolve();
      }, 10000);

      onvif.startProbe().then((deviceList) => {
        clearTimeout(discoveryTimeout);
        console.log(`[Discovery] Found ${deviceList.length} ONVIF device(s)`);

        deviceList.forEach((device) => {
          const cameraInfo = {
            id: this.sanitizeId(`onvif-${device.urn}`),
            type: 'onvif',
            name: device.name || 'ONVIF Camera',
            manufacturer: device.hardware || 'Unknown',
            model: device.hardware || 'Unknown',
            address: device.xaddrs[0] || '',
            onvifAddress: device.xaddrs[0] || '',
            urn: device.urn,
            scopes: device.scopes || [],
            requiresAuth: true,
            rtspPorts: [554, 8554], // Puertos RTSP comunes
            discovered: new Date().toISOString()
          };

          // Intentar extraer el IP del xaddrs
          try {
            const url = new URL(device.xaddrs[0]);
            cameraInfo.ip = url.hostname;
            cameraInfo.port = url.port || 80;
          } catch (e) {
            console.error('[Discovery] Error parsing ONVIF address:', e);
          }

          this.discoveredDevices.push(cameraInfo);
        });

        this.discoveryProgress.devicesFound = this.discoveredDevices.length;
        this.discoveryProgress.progress = 40;
        resolve();
      }).catch((error) => {
        clearTimeout(discoveryTimeout);
        console.error('[Discovery] ONVIF discovery error:', error);
        resolve(); // No fallar si ONVIF no funciona
      });
    });
  }

  /**
   * Descubre cámaras Tapo usando credenciales de cuenta TP-Link
   */
  async discoverTapoCameras(email, password) {
    try {
      console.log('[Discovery] Starting Tapo discovery...');
      this.discoveryProgress.message = 'Buscando cámaras Tapo...';
      this.discoveryProgress.progress = 50;

      const cloudAPI = await cloudLogin(email, password);
      const deviceList = await cloudAPI.listDevices();

      const tapoCameras = deviceList.filter(device =>
        device.deviceType === 'SMART.IPCAMERA' ||
        device.deviceModel?.startsWith('C')
      );

      console.log(`[Discovery] Found ${tapoCameras.length} Tapo camera(s)`);

      tapoCameras.forEach(device => {
        const cameraInfo = {
          id: this.sanitizeId(`tapo-${device.deviceId}`),
          type: 'tapo',
          name: device.alias || device.deviceModel || 'Tapo Camera',
          manufacturer: 'TP-Link',
          model: device.deviceModel || 'Unknown',
          deviceId: device.deviceId,
          ip: device.deviceIp || 'Unknown',
          macAddress: device.deviceMac,
          firmwareVersion: device.fwVer,
          requiresAuth: true,
          discovered: new Date().toISOString(),
          cloudConnected: device.status === 1
        };

        this.discoveredDevices.push(cameraInfo);
      });

      this.discoveryProgress.devicesFound = this.discoveredDevices.length;
      this.discoveryProgress.progress = 70;
    } catch (error) {
      console.error('[Discovery] Tapo discovery error:', error);
      // No fallar si Tapo no funciona
    }
  }

  /**
   * Escanea puertos RTSP comunes en la red local
   */
  async scanRtspPorts(networks) {
    console.log('[Discovery] Starting RTSP port scan...');
    this.discoveryProgress.message = 'Escaneando puertos RTSP...';
    this.discoveryProgress.progress = 75;

    const commonRtspPorts = [554, 8554, 8080, 88];
    const scanPromises = [];

    // Limitar el escaneo a una subred específica para evitar tiempos largos
    // Por ahora, escaneamos solo IPs conocidas de ONVIF
    const onvifDevices = this.discoveredDevices.filter(d => d.type === 'onvif' && d.ip);

    for (const device of onvifDevices) {
      for (const port of commonRtspPorts) {
        if (!device.rtspPorts.includes(port)) {
          scanPromises.push(
            this.checkRtspPort(device.ip, port).then(isOpen => {
              if (isOpen && !device.rtspPorts.includes(port)) {
                device.rtspPorts.push(port);
              }
            })
          );
        }
      }
    }

    await Promise.all(scanPromises);
    this.discoveryProgress.progress = 90;
  }

  /**
   * Verifica si un puerto RTSP está abierto
   */
  async checkRtspPort(ip, port, timeout = 2000) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let isOpen = false;

      socket.setTimeout(timeout);

      socket.on('connect', () => {
        isOpen = true;
        socket.destroy();
      });

      socket.on('timeout', () => {
        socket.destroy();
      });

      socket.on('error', () => {
        // Puerto cerrado o inalcanzable
      });

      socket.on('close', () => {
        resolve(isOpen);
      });

      socket.connect(port, ip);
    });
  }

  /**
   * Prueba la conexión a una cámara con credenciales
   */
  async testCameraConnection(camera, credentials = {}) {
    console.log(`[Discovery] Testing connection to ${camera.type} camera at ${camera.ip || camera.address}`);

    try {
      switch (camera.type) {
        case 'onvif':
          return await this.testOnvifConnection(camera, credentials);

        case 'tapo':
          return await this.testTapoConnection(camera, credentials);

        default:
          throw new Error(`Unsupported camera type: ${camera.type}`);
      }
    } catch (error) {
      console.error('[Discovery] Connection test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Prueba conexión ONVIF
   */
  async testOnvifConnection(camera, credentials) {
    try {
      const { username, password } = credentials;

      if (!username || !password) {
        return {
          success: false,
          error: 'Username and password required for ONVIF cameras'
        };
      }

      // Crear dispositivo ONVIF
      const device = new onvif.OnvifDevice({
        xaddr: camera.onvifAddress,
        user: username,
        pass: password
      });

      // Inicializar el dispositivo
      await device.init();

      // Obtener información del dispositivo
      const deviceInfo = {
        manufacturer: device.information?.manufacturer || 'Unknown',
        model: device.information?.model || 'Unknown',
        firmwareVersion: device.information?.firmwareVersion || 'Unknown',
        serialNumber: device.information?.serialNumber || 'Unknown',
        hardwareId: device.information?.hardwareId || 'Unknown'
      };

      // Intentar obtener perfiles de streaming
      let profiles = [];
      try {
        // node-onvif usa una estructura diferente para los perfiles
        if (device.services && device.services.media) {
          const mediaService = device.services.media;

          // Obtener perfiles de video
          if (mediaService.profiles) {
            profiles = mediaService.profiles.map((profile, index) => {
              // Construir URL RTSP manualmente basándose en el perfil
              const rtspUrl = `rtsp://${username}:${password}@${camera.ip}:554/`;

              return {
                name: profile.name || `Profile ${index + 1}`,
                token: profile.token,
                uri: rtspUrl,
                videoEncoder: profile.videoEncoderConfiguration?.name || 'Unknown',
                resolution: profile.videoEncoderConfiguration?.resolution || { width: 1920, height: 1080 }
              };
            });
          }
        }
      } catch (profileError) {
        console.error('[Discovery] Error getting profiles:', profileError);
        // Continuar incluso si no podemos obtener perfiles
      }

      // Si no pudimos obtener perfiles, devolver éxito con info básica
      return {
        success: true,
        deviceInfo,
        profiles: profiles.length > 0 ? profiles : [],
        message: profiles.length > 0
          ? `Connected successfully. Found ${profiles.length} profile(s)`
          : 'Connected successfully. Unable to retrieve profiles, but device is reachable.',
        hasProfiles: profiles.length > 0
      };

    } catch (error) {
      console.error('[Discovery] ONVIF connection test failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to connect to ONVIF camera'
      };
    }
  }

  /**
   * Prueba conexión Tapo
   */
  async testTapoConnection(camera, credentials) {
    try {
      const { username, password } = credentials;

      if (!username || !password) {
        return {
          success: false,
          error: 'Username and password required for Tapo cameras'
        };
      }

      // Para cámaras Tapo, necesitamos usar la librería tp-link-tapo-connect
      const device = await loginDevice(username, password, camera.ip);
      const deviceInfo = await device.getDeviceInfo();

      return {
        success: true,
        deviceInfo,
        rtspPort: 554,
        message: 'Connected successfully to Tapo camera'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Genera URLs RTSP sugeridas para una cámara
   */
  generateRtspUrls(camera, credentials = {}) {
    const { username = 'admin', password = '' } = credentials;
    const auth = username && password ? `${username}:${password}@` : '';
    const urls = [];

    if (camera.type === 'onvif' && camera.ip) {
      // URLs RTSP comunes para cámaras ONVIF
      const ports = camera.rtspPorts && camera.rtspPorts.length > 0 ? camera.rtspPorts : [554];

      ports.forEach(port => {
        // URLs genéricas más comunes primero
        urls.push(`rtsp://${auth}${camera.ip}:${port}/`);
        urls.push(`rtsp://${auth}${camera.ip}:${port}/stream1`);
        urls.push(`rtsp://${auth}${camera.ip}:${port}/stream2`);

        // URLs específicas por fabricante
        urls.push(`rtsp://${auth}${camera.ip}:${port}/live/main`);
        urls.push(`rtsp://${auth}${camera.ip}:${port}/live/sub`);
        urls.push(`rtsp://${auth}${camera.ip}:${port}/Streaming/Channels/101`); // HikVision
        urls.push(`rtsp://${auth}${camera.ip}:${port}/Streaming/Channels/102`); // HikVision substream
        urls.push(`rtsp://${auth}${camera.ip}:${port}/cam/realmonitor?channel=1&subtype=0`); // Dahua
        urls.push(`rtsp://${auth}${camera.ip}:${port}/live.sdp`); // Axis
        urls.push(`rtsp://${auth}${camera.ip}:${port}/onvif1`); // Generic ONVIF
        urls.push(`rtsp://${auth}${camera.ip}:${port}/onvif2`); // Generic ONVIF
        urls.push(`rtsp://${auth}${camera.ip}:${port}/h264`); // Generic H264
        urls.push(`rtsp://${auth}${camera.ip}:${port}/video1`); // Generic
        urls.push(`rtsp://${auth}${camera.ip}:${port}/11`); // Algunos modelos
      });
    } else if (camera.type === 'tapo' && camera.ip) {
      // URL RTSP para cámaras Tapo
      urls.push(`rtsp://${auth}${camera.ip}:554/stream1`);
      urls.push(`rtsp://${auth}${camera.ip}:554/stream2`);
    } else if (camera.type === 'yi' && camera.ip) {
      // URL RTSP para cámaras Yi
      urls.push(`rtsp://${auth}${camera.ip}:554/`);
      urls.push(`rtsp://${auth}${camera.ip}:554/ch0_0.h264`);
      urls.push(`rtsp://${auth}${camera.ip}:554/ch0_1.h264`);
    }

    return urls;
  }

  /**
   * Obtiene el estado actual del descubrimiento
   */
  getDiscoveryStatus() {
    return {
      ...this.discoveryProgress,
      inProgress: this.discoveryInProgress
    };
  }

  /**
   * Obtiene los dispositivos descubiertos
   */
  getDiscoveredDevices() {
    return this.discoveredDevices;
  }

  /**
   * Limpia los dispositivos descubiertos
   */
  clearDiscoveredDevices() {
    this.discoveredDevices = [];
    this.discoveryProgress = {
      status: 'idle',
      progress: 0,
      message: '',
      devicesFound: 0
    };
  }
}

// Singleton
const cameraDiscovery = new CameraDiscovery();

export default cameraDiscovery;
