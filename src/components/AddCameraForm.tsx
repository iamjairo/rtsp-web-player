import { useState } from 'react';
import type { Camera } from '../types';
import { Plus, X } from 'lucide-react';

interface AddCameraFormProps {
  onAdd: (camera: Omit<Camera, 'id'>) => void;
}

export function AddCameraForm({ onAdd }: AddCameraFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState<Camera['type']>('hls');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !url.trim()) {
      alert('Por favor completa todos los campos');
      return;
    }

    onAdd({ name: name.trim(), url: url.trim(), type });

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
            />
            <p className="mt-1 text-xs text-gray-400">
              Para RTSP, necesitarás convertir a HLS usando un servidor como FFmpeg
            </p>
          </div>

          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-300 mb-1">
              Tipo de Stream
            </label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as Camera['type'])}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="hls">HLS (.m3u8)</option>
              <option value="rtsp">RTSP (requiere conversión)</option>
              <option value="mjpeg">MJPEG</option>
              <option value="webrtc">WebRTC</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            >
              Agregar
            </button>
          </div>
        </form>

        <div className="mt-4 p-3 bg-gray-700/50 rounded border border-gray-600">
          <p className="text-xs text-gray-300 font-medium mb-1">💡 Nota sobre RTSP:</p>
          <p className="text-xs text-gray-400">
            Los navegadores no pueden reproducir RTSP directamente. Necesitas un servidor que convierta
            el stream RTSP a HLS o WebRTC. Puedes usar herramientas como FFmpeg, MediaMTX, o go2rtc.
          </p>
        </div>
      </div>
    </div>
  );
}
