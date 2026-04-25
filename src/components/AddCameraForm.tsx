import { useState } from 'react';
import type { Camera } from '../types';
import { Plus, X, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface AddCameraFormProps {
  onAdd: (camera: Omit<Camera, 'id'>) => void;
}

const BACKEND_URL = API_BASE_URL;

/** Derive the WebSocket URL from an HTTP API base URL. */
function httpToWs(httpUrl: string): string {
  return httpUrl.replace(/^http/, 'ws');
}

export function AddCameraForm({ onAdd }: AddCameraFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState<Camera['type']>('hls');
  const [isConverting, setIsConverting] = useState(false);
  const [autoConvert, setAutoConvert] = useState(true);
  const [lowLatency, setLowLatency] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !url.trim()) {
      alert('Please fill in all fields');
      return;
    }

    const trimmedUrl = url.trim();
    const trimmedName = name.trim();

    const isRtsp = trimmedUrl.startsWith('rtsp://') || trimmedUrl.startsWith('rtsps://');

    if (autoConvert && isRtsp) {
      try {
        setIsConverting(true);

        const streamId = `cam_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

        if (lowLatency) {
          // ── Low-latency path: RTSP → fMP4 → WebSocket ──────────────────────
          const response = await fetch(`${BACKEND_URL}/api/ws-streams`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: streamId, rtspUrl: trimmedUrl }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error starting low-latency stream');
          }

          const data = await response.json();
          // Convert the ws:// URL — if backend runs on a different host, the
          // consumer should adjust VITE_API_URL accordingly.
          const wsUrl = httpToWs(`${BACKEND_URL}${data.stream.wsPath}`);

          onAdd({ name: trimmedName, url: wsUrl, type: 'ws' });
          alert(`✅ Camera "${trimmedName}" added (low-latency WebSocket mode)`);
        } else {
          // ── Standard path: RTSP → HLS ───────────────────────────────────────
          const response = await fetch(`${BACKEND_URL}/api/streams`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: streamId, rtspUrl: trimmedUrl }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error starting HLS conversion');
          }

          const data = await response.json();
          onAdd({ name: trimmedName, url: data.stream.hlsUrl, type: 'hls' });
          alert(`✅ Camera "${trimmedName}" added (HLS mode)`);
        }
      } catch (error) {
        console.error('Error converting stream:', error);
        alert(
          `❌ Error converting RTSP stream:\n\n${
            error instanceof Error ? error.message : 'Unknown error'
          }\n\nMake sure:\n1. The backend is running (npm run server)\n2. FFmpeg is installed\n3. The RTSP URL is correct`
        );
        return;
      } finally {
        setIsConverting(false);
      }
    } else {
      onAdd({ name: trimmedName, url: trimmedUrl, type });
    }

    // Reset form
    setName('');
    setUrl('');
    setType('hls');
    setLowLatency(false);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setName('');
    setUrl('');
    setType('hls');
    setLowLatency(false);
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
          <h2 className="text-xl font-bold text-white">Add Camera</h2>
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
                Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Front Door Camera"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
          </div>

          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-300 mb-1">
              Stream URL
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
            {(url.startsWith('rtsp://') || url.startsWith('rtsps://')) && autoConvert && (
              <p className="mt-1 text-xs text-green-400 flex items-center gap-1">
                <span>✓</span>
                <span>
                  Will be auto-converted to {lowLatency ? 'WebSocket (low-latency)' : 'HLS'} by the backend
                </span>
              </p>
            )}
          </div>

          {!url.startsWith('rtsp://') && !url.startsWith('rtsps://') && (
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-300 mb-1">
                Stream Type
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
                <option value="webrtc">WebRTC (WHEP)</option>
                <option value="ws">WebSocket / low-latency</option>
              </select>
              {type === 'webrtc' && (
                <p className="mt-1 text-xs text-blue-400">
                  Enter the WHEP HTTP endpoint URL (e.g. http://camera-ip/webrtc/whep)
                </p>
              )}
              {type === 'ws' && (
                <p className="mt-1 text-xs text-blue-400">
                  Enter a WebSocket URL (e.g. ws://localhost:3001/api/ws-streams/cam1/live)
                </p>
              )}
            </div>
          )}

          {(url.startsWith('rtsp://') || url.startsWith('rtsps://')) && (
            <div className="bg-blue-900/30 border border-blue-700 rounded-md p-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoConvert}
                  onChange={(e) => setAutoConvert(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  disabled={isConverting}
                />
                <span className="text-sm text-gray-200">Auto-convert using backend (FFmpeg)</span>
              </label>

              {autoConvert && (
                <label className="flex items-center gap-2 cursor-pointer ml-6">
                  <input
                    type="checkbox"
                    checked={lowLatency}
                    onChange={(e) => setLowLatency(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 text-purple-500 focus:ring-2 focus:ring-purple-500"
                    disabled={isConverting}
                  />
                  <span className="text-sm text-gray-200">
                    Low-latency mode{' '}
                    <span className="text-xs text-purple-400">(WebSocket / ~1-3 s latency)</span>
                  </span>
                </label>
              )}

              {autoConvert && !lowLatency && (
                <p className="text-xs text-gray-400 ml-6">
                  Standard HLS mode (~6-10 s latency, most compatible)
                </p>
              )}
              {autoConvert && lowLatency && (
                <p className="text-xs text-gray-400 ml-6">
                  Streams fMP4 over WebSocket using MSE — H.264 required, Chrome/Edge recommended
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isConverting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={isConverting}
            >
              {isConverting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Converting…</span>
                </>
              ) : (
                'Add Camera'
              )}
            </button>
          </div>
        </form>

        <div className="mt-4 p-3 bg-gray-700/50 rounded border border-gray-600">
          <p className="text-xs text-gray-300 font-medium mb-1">💡 Integrated RTSP conversion:</p>
          <p className="text-xs text-gray-400">
            The backend converts RTSP streams to HLS or low-latency WebSocket automatically.
            Make sure the backend is running (<code className="bg-gray-800 px-1 rounded">npm run server</code>)
            and FFmpeg is installed (bundled in the desktop app).
          </p>
        </div>
      </div>
    </div>
  );
}
