import { useState } from 'react';
import type { Camera } from './types';
import { VideoPlayer } from './components/VideoPlayer';
import { AddCameraForm } from './components/AddCameraForm';
import CameraDiscovery from './components/CameraDiscovery';
import { useLocalStorage } from './hooks/useLocalStorage';
import { Video, Grid3x3, Grid2x2, LayoutGrid, Trash2, Search } from 'lucide-react';

function App() {
  const [cameras, setCameras] = useLocalStorage<Camera[]>('rtsp-cameras', []);
  const [gridColumns, setGridColumns] = useState(2);
  const [showDiscovery, setShowDiscovery] = useState(false);

  const addCamera = (cameraData: Omit<Camera, 'id'>) => {
    const newCamera: Camera = {
      ...cameraData,
      id: crypto.randomUUID(),
    };
    setCameras([...cameras, newCamera]);
  };

  const removeCamera = (id: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar esta cámara?')) {
      setCameras(cameras.filter((cam) => cam.id !== id));
    }
  };

  const clearAllCameras = () => {
    if (cameras.length === 0) return;

    if (confirm('¿Estás seguro de que quieres eliminar todas las cámaras?')) {
      setCameras([]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-40 shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Video className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">RTSP Web Player</h1>
                <p className="text-sm text-gray-400">
                  {cameras.length} {cameras.length === 1 ? 'cámara' : 'cámaras'} activas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Discovery button */}
              <button
                onClick={() => setShowDiscovery(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                title="Descubrir cámaras en red local"
              >
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">Descubrir Cámaras</span>
              </button>

              {/* Grid layout selector */}
              <div className="flex items-center gap-2 bg-slate-700 rounded-lg p-1">
                <button
                  onClick={() => setGridColumns(1)}
                  className={`p-2 rounded transition-colors ${
                    gridColumns === 1 ? 'bg-blue-600' : 'hover:bg-slate-600'
                  }`}
                  title="1 columna"
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setGridColumns(2)}
                  className={`p-2 rounded transition-colors ${
                    gridColumns === 2 ? 'bg-blue-600' : 'hover:bg-slate-600'
                  }`}
                  title="2 columnas"
                >
                  <Grid2x2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setGridColumns(3)}
                  className={`p-2 rounded transition-colors ${
                    gridColumns === 3 ? 'bg-blue-600' : 'hover:bg-slate-600'
                  }`}
                  title="3 columnas"
                >
                  <Grid3x3 className="w-5 h-5" />
                </button>
              </div>

              {/* Clear all button */}
              {cameras.length > 0 && (
                <button
                  onClick={clearAllCameras}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Eliminar todas</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6">
        {cameras.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="p-6 bg-slate-800 rounded-full mb-4">
              <Video className="w-16 h-16 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">No hay cámaras configuradas</h2>
            <p className="text-gray-400 mb-6 max-w-md">
              Haz clic en el botón + para agregar tu primera cámara RTSP
            </p>
            <div className="bg-slate-800 rounded-lg p-6 max-w-2xl">
              <h3 className="text-lg font-semibold mb-3">Formatos soportados:</h3>
              <ul className="text-left space-y-2 text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span><strong>HLS (.m3u8)</strong> - Formato recomendado para streams RTSP convertidos</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span><strong>MJPEG</strong> - Streams de cámaras IP que soportan MJPEG</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span><strong>WebRTC</strong> - Streams de baja latencia</span>
                </li>
              </ul>
            </div>
          </div>
        ) : (
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
            }}
          >
            {cameras.map((camera) => (
              <VideoPlayer key={camera.id} camera={camera} onRemove={removeCamera} />
            ))}
          </div>
        )}
      </main>

      {/* Add camera button/form */}
      <AddCameraForm onAdd={addCamera} />

      {/* Camera Discovery Modal */}
      {showDiscovery && (
        <CameraDiscovery
          onAddCamera={(camera) => {
            setCameras([...cameras, camera]);
          }}
          onClose={() => setShowDiscovery(false)}
        />
      )}

      {/* Footer */}
      <footer className="mt-12 py-6 bg-slate-800 border-t border-slate-700">
        <div className="container mx-auto px-4 text-center text-gray-400 text-sm">
          <p>RTSP Web Player - Reproduce múltiples streams de cámaras simultáneamente</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
