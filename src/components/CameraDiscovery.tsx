import { useState, useEffect } from 'react';
import { Search, Wifi, Camera as CameraIcon, CheckCircle, AlertCircle, Loader2, Lock, Plus, X } from 'lucide-react';
import type { DiscoveredCamera, DiscoveryStatus, CameraCredentials, Camera } from '../types';

interface CameraDiscoveryProps {
  onAddCamera: (camera: Camera) => void;
  onClose: () => void;
}

export default function CameraDiscovery({ onAddCamera, onClose }: CameraDiscoveryProps) {
  const [discoveryStatus, setDiscoveryStatus] = useState<DiscoveryStatus>({
    status: 'idle',
    progress: 0,
    message: '',
    devicesFound: 0,
    inProgress: false
  });
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredCamera[]>([]);
  const [tapoEmail, setTapoEmail] = useState('');
  const [tapoPassword, setTapoPassword] = useState('');
  const [showTapoCredentials, setShowTapoCredentials] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DiscoveredCamera | null>(null);
  const [deviceCredentials, setDeviceCredentials] = useState<CameraCredentials>({
    username: '',
    password: ''
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<any>(null);

  const API_BASE = 'http://localhost:3001/api';

  // Polling del estado del descubrimiento
  useEffect(() => {
    let interval: number | undefined;

    if (discoveryStatus.inProgress) {
      interval = window.setInterval(async () => {
        try {
          const response = await fetch(`${API_BASE}/discovery/status`);
          const data = await response.json();
          setDiscoveryStatus(data);

          // Obtener dispositivos encontrados
          if (data.devicesFound > 0) {
            const devicesResponse = await fetch(`${API_BASE}/discovery/devices`);
            const devicesData = await devicesResponse.json();
            setDiscoveredDevices(devicesData.devices || []);
          }

          // Detener polling si terminó
          if (data.status === 'completed' || data.status === 'error') {
            clearInterval(interval);
          }
        } catch (error) {
          console.error('Error fetching discovery status:', error);
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [discoveryStatus.inProgress]);

  const startDiscovery = async () => {
    try {
      const response = await fetch(`${API_BASE}/discovery/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tapoEmail: showTapoCredentials ? tapoEmail : undefined,
          tapoPassword: showTapoCredentials ? tapoPassword : undefined,
          scanRtsp: true
        })
      });

      const data = await response.json();
      setDiscoveryStatus(data.status);
    } catch (error) {
      console.error('Error starting discovery:', error);
      alert('Error al iniciar el descubrimiento');
    }
  };

  const testConnection = async (device: DiscoveredCamera) => {
    setTestingConnection(true);
    setConnectionResult(null);

    try {
      const response = await fetch(`${API_BASE}/discovery/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          camera: device,
          credentials: deviceCredentials
        })
      });

      const result = await response.json();
      setConnectionResult(result);

      if (result.success) {
        // Si la conexión fue exitosa, obtener URLs RTSP
        const urlsResponse = await fetch(`${API_BASE}/discovery/rtsp-urls`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            camera: device,
            credentials: deviceCredentials
          })
        });

        const urlsData = await urlsResponse.json();
        setConnectionResult({ ...result, suggestedUrls: urlsData.urls });
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setConnectionResult({ success: false, error: 'Error al probar la conexión' });
    } finally {
      setTestingConnection(false);
    }
  };

  const addCameraFromDevice = async (device: DiscoveredCamera, rtspUrl: string) => {
    try {
      // Agregar el stream al backend
      const response = await fetch(`${API_BASE}/streams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: device.id,
          rtspUrl
        })
      });

      const data = await response.json();

      if (data.success) {
        // Agregar al frontend
        const newCamera: Camera = {
          id: device.id,
          name: device.name,
          url: data.stream.hlsUrl,
          type: 'hls'
        };

        onAddCamera(newCamera);
        setSelectedDevice(null);
        alert(`Cámara "${device.name}" agregada exitosamente`);
      } else {
        throw new Error(data.error || 'Error al agregar cámara');
      }
    } catch (error: any) {
      console.error('Error adding camera:', error);
      alert(`Error al agregar cámara: ${error.message}`);
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'onvif':
        return <CameraIcon className="w-5 h-5 text-blue-500" />;
      case 'tapo':
        return <CameraIcon className="w-5 h-5 text-green-500" />;
      case 'yi':
        return <CameraIcon className="w-5 h-5 text-orange-500" />;
      default:
        return <CameraIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-900 p-4 flex items-center justify-between border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Search className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-bold text-white">Descubrir Cámaras en Red Local</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Discovery Controls */}
          <div className="mb-6">
            <div className="flex gap-4 mb-4">
              <button
                onClick={startDiscovery}
                disabled={discoveryStatus.inProgress}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
              >
                {discoveryStatus.inProgress ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Wifi className="w-5 h-5" />
                )}
                {discoveryStatus.inProgress ? 'Descubriendo...' : 'Iniciar Descubrimiento'}
              </button>

              <button
                onClick={() => setShowTapoCredentials(!showTapoCredentials)}
                className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Lock className="w-5 h-5" />
                {showTapoCredentials ? 'Ocultar' : 'Credenciales Tapo'}
              </button>
            </div>

            {/* Tapo Credentials */}
            {showTapoCredentials && (
              <div className="bg-gray-700 p-4 rounded-lg mb-4">
                <h3 className="text-white font-semibold mb-3">Credenciales TP-Link Tapo</h3>
                <p className="text-gray-300 text-sm mb-3">
                  Ingresa tus credenciales de la cuenta TP-Link para descubrir cámaras Tapo
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="email"
                    placeholder="Email de TP-Link"
                    value={tapoEmail}
                    onChange={(e) => setTapoEmail(e.target.value)}
                    className="px-3 py-2 bg-gray-600 text-white rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="password"
                    placeholder="Contraseña"
                    value={tapoPassword}
                    onChange={(e) => setTapoPassword(e.target.value)}
                    className="px-3 py-2 bg-gray-600 text-white rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Progress Bar */}
            {discoveryStatus.inProgress && (
              <div className="bg-gray-700 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white text-sm">{discoveryStatus.message}</span>
                  <span className="text-blue-400 text-sm font-semibold">{discoveryStatus.progress}%</span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${discoveryStatus.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Status Message */}
            {discoveryStatus.status === 'completed' && (
              <div className="bg-green-900 bg-opacity-30 border border-green-600 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-100">{discoveryStatus.message}</span>
              </div>
            )}

            {discoveryStatus.status === 'error' && (
              <div className="bg-red-900 bg-opacity-30 border border-red-600 rounded-lg p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <span className="text-red-100">{discoveryStatus.message}</span>
              </div>
            )}
          </div>

          {/* Discovered Devices */}
          {discoveredDevices.length > 0 && (
            <div>
              <h3 className="text-white font-semibold mb-4 text-lg">
                Dispositivos Encontrados ({discoveredDevices.length})
              </h3>
              <div className="grid gap-4">
                {discoveredDevices.map((device) => (
                  <div
                    key={device.id}
                    className="bg-gray-700 rounded-lg p-4 border border-gray-600 hover:border-blue-500 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {getDeviceIcon(device.type)}
                        <div className="flex-1">
                          <h4 className="text-white font-semibold">{device.name}</h4>
                          <div className="text-sm text-gray-300 mt-1 space-y-1">
                            {device.manufacturer && (
                              <p>Fabricante: {device.manufacturer}</p>
                            )}
                            {device.model && (
                              <p>Modelo: {device.model}</p>
                            )}
                            {device.ip && (
                              <p>IP: {device.ip}</p>
                            )}
                            <p>
                              Tipo: <span className="text-blue-400 uppercase">{device.type}</span>
                            </p>
                            {device.requiresAuth && (
                              <p className="text-yellow-400 flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                Requiere autenticación
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedDevice(device);
                          setConnectionResult(null);
                          setDeviceCredentials({ username: '', password: '' });
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Conectar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {discoveredDevices.length === 0 && discoveryStatus.status === 'completed' && (
            <div className="text-center py-12 text-gray-400">
              <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No se encontraron dispositivos</p>
              <p className="text-sm mt-2">Verifica que las cámaras estén encendidas y en la misma red</p>
            </div>
          )}
        </div>

        {/* Device Connection Modal */}
        {selectedDevice && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-60 p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="bg-gray-900 p-4 flex items-center justify-between border-b border-gray-700">
                <h3 className="text-xl font-bold text-white">Conectar a {selectedDevice.name}</h3>
                <button
                  onClick={() => setSelectedDevice(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                {/* Credentials Form */}
                {selectedDevice.requiresAuth && !connectionResult?.success && (
                  <div className="mb-6">
                    <h4 className="text-white font-semibold mb-3">Credenciales de Cámara</h4>
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Usuario (ej: admin)"
                        value={deviceCredentials.username}
                        onChange={(e) => setDeviceCredentials({ ...deviceCredentials, username: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                      />
                      <input
                        type="password"
                        placeholder="Contraseña"
                        value={deviceCredentials.password}
                        onChange={(e) => setDeviceCredentials({ ...deviceCredentials, password: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                      />
                      <button
                        onClick={() => testConnection(selectedDevice)}
                        disabled={testingConnection || !deviceCredentials.username || !deviceCredentials.password}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                      >
                        {testingConnection ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Probando conexión...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-5 h-5" />
                            Probar Conexión
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Connection Result */}
                {connectionResult && (
                  <div className="mb-6">
                    {connectionResult.success ? (
                      <div className="bg-green-900 bg-opacity-30 border border-green-600 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-4">
                          <CheckCircle className="w-6 h-6 text-green-400" />
                          <div className="flex-1">
                            <span className="text-green-100 font-semibold block">Conexión Exitosa</span>
                            {connectionResult.message && (
                              <span className="text-green-200 text-sm">{connectionResult.message}</span>
                            )}
                          </div>
                        </div>

                        {/* Device Info */}
                        {connectionResult.deviceInfo && (
                          <div className="mb-4 p-3 bg-gray-800 rounded text-sm">
                            <h6 className="text-white font-semibold mb-2">Información del Dispositivo:</h6>
                            <div className="text-gray-300 space-y-1">
                              {connectionResult.deviceInfo.manufacturer && (
                                <p>Fabricante: {connectionResult.deviceInfo.manufacturer}</p>
                              )}
                              {connectionResult.deviceInfo.model && (
                                <p>Modelo: {connectionResult.deviceInfo.model}</p>
                              )}
                              {connectionResult.deviceInfo.firmwareVersion && (
                                <p>Firmware: {connectionResult.deviceInfo.firmwareVersion}</p>
                              )}
                            </div>
                          </div>
                        )}

                        {connectionResult.suggestedUrls && connectionResult.suggestedUrls.length > 0 && (
                          <div>
                            <h5 className="text-white font-semibold mb-3">
                              URLs RTSP Sugeridas (Haz clic para agregar):
                            </h5>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {connectionResult.suggestedUrls.slice(0, 10).map((url: string, index: number) => (
                                <button
                                  key={index}
                                  onClick={() => addCameraFromDevice(selectedDevice, url)}
                                  className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white font-mono flex items-center justify-between group"
                                  title="Haz clic para agregar esta cámara con esta URL"
                                >
                                  <span className="truncate flex-1">{url}</span>
                                  <Plus className="w-4 h-4 text-green-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0" />
                                </button>
                              ))}
                            </div>
                            <p className="text-gray-400 text-xs mt-3">
                              Nota: Algunas URLs pueden no funcionar. Prueba diferentes opciones si una no funciona.
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-red-900 bg-opacity-30 border border-red-600 rounded-lg p-4 flex items-center gap-3">
                        <AlertCircle className="w-6 h-6 text-red-400" />
                        <div>
                          <span className="text-red-100 font-semibold block">Error de Conexión</span>
                          <span className="text-red-200 text-sm">{connectionResult.error}</span>
                          <p className="text-red-200 text-xs mt-2">
                            Verifica que el usuario y contraseña sean correctos y que la cámara sea accesible.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
