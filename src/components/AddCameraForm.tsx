import { useState } from 'react';
import type { Camera } from '../types';
import { Plus, X, Loader2 } from 'lucide-react';

interface AddCameraFormProps {
  onAdd: (camera: Omit<Camera, 'id'>) => void;
}

const BACKEND_URL = 'http://localhost:3001';

export function AddCameraForm({ onAdd }: AddCameraFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState<Camera['type']>('hls');
  const [isConverting, setIsConverting] = useState(false);
  const [autoConvert, setAutoConvert] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !url.trim()) {
      alert('Por favor completa todos los campos');
      return;
    }

    const trimmedUrl = url.trim();
    const trimmedName = name.trim();

    // Si es una URL RTSP y la conversión automática está habilitada
    if (autoConvert && trimmedUrl.startsWith('rtsp://')) {
      try {
        setIsConverting(true);

        // Generar ID único para el stream
        const streamId = `cam_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        console.log('Enviando stream al backend para conversión:', { streamId, rtspUrl: trimmedUrl });

        // Enviar al backend para conversión
        const response = await fetch(`${BACKEND_URL}/api/streams`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: streamId,
            rtspUrl: trimmedUrl,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Error al iniciar la conversión');
        }

        const data = await response.json();
        console.log('Stream convertido exitosamente:', data);

        // Agregar la cámara con la URL HLS convertida
        onAdd({
          name: trimmedName,
          url: data.stream.hlsUrl,
          type: 'hls',
        });

        alert(`✅ Cámara "${trimmedName}" agregada y conversión RTSP iniciada correctamente`);
      } catch (error) {
        console.error('Error al convertir stream:', error);
        alert(
          `❌ Error al convertir el stream RTSP:\n\n${error instanceof Error ? error.message : 'Error desconocido'}\n\nAsegúrate de que:\n1. El backend está corriendo (npm run server)\n2. FFmpeg está instalado\n3. La URL RTSP es correcta`
        );
        return;
      } finally {
        setIsConverting(false);
      }
    } else {
      // Para otros tipos de streams o si la conversión automática está deshabilitada
      onAdd({ name: trimmedName, url: trimmedUrl, type });
    }

    // Reset form
    setName('');
    setUrl('');
    setType('hls');
    setIsOpen(false);
  };

  const handleCancel = () => {
    setName('');
    setUrl('');
    setType('hls');
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all hover:scale-110 z-50"
        title="Agregar cámara"
      >
        <Plus className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Agregar Cámara</h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
              Nombre
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Cámara Principal"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-300 mb-1">
              URL del Stream
            </label>
            <input
              type="text"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="rtsp://... o http://..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isConverting}
            />
            {url.startsWith('rtsp://') && autoConvert && (
              <p className="mt-1 text-xs text-green-400 flex items-center gap-1">
                <span>✓</span>
                <span>Se convertirá automáticamente a HLS usando el backend</span>
              </p>
            )}
          </div>

          {!url.startsWith('rtsp://') && (
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-300 mb-1">
                Tipo de Stream
              </label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value as Camera['type'])}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isConverting}
              >
                <option value="hls">HLS (.m3u8)</option>
                <option value="mjpeg">MJPEG</option>
                <option value="webrtc">WebRTC</option>
              </select>
            </div>
          )}

          {url.startsWith('rtsp://') && (
            <div className="bg-blue-900/30 border border-blue-700 rounded-md p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoConvert}
                  onChange={(e) => setAutoConvert(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  disabled={isConverting}
                />
                <span className="text-sm text-gray-200">
                  Convertir automáticamente usando el backend
                </span>
              </label>
              <p className="mt-1 text-xs text-gray-400 ml-6">
                El backend usará FFmpeg para convertir RTSP a HLS en tiempo real
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isConverting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={isConverting}
            >
              {isConverting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Convirtiendo...</span>
                </>
              ) : (
                'Agregar'
              )}
            </button>
          </div>
        </form>

        <div className="mt-4 p-3 bg-gray-700/50 rounded border border-gray-600">
          <p className="text-xs text-gray-300 font-medium mb-1">💡 Conversión RTSP integrada:</p>
          <p className="text-xs text-gray-400">
            Esta aplicación incluye un backend que convierte automáticamente streams RTSP a HLS.
            Asegúrate de que el backend esté corriendo (<code className="bg-gray-800 px-1 rounded">npm run server</code>)
            y que FFmpeg esté instalado en tu sistema.
          </p>
        </div>
      </div>
    </div>
  );
}
