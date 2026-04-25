import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import type { Camera } from '../types';
import { Video, VideoOff, Trash2 } from 'lucide-react';

interface VideoPlayerProps {
  camera: Camera;
  onRemove: (id: string) => void;
}

export function VideoPlayer({ camera, onRemove }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── HLS ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (camera.type !== 'hls') return;

    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);
    setError(null);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        backBufferLength: 10,
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 3,
        fragLoadingTimeOut: 20000,
        manifestLoadingTimeOut: 10000,
        levelLoadingTimeOut: 10000,
        fragLoadingMaxRetry: 6,
        levelLoadingMaxRetry: 4,
        manifestLoadingMaxRetry: 6,
        startPosition: -1,
        liveSyncDuration: 3,
        liveMaxLatencyDuration: 10,
        abrEwmaFastLive: 3,
        abrEwmaSlowLive: 9,
      });

      hls.loadSource(camera.url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch((err) => {
          console.error('Error playing HLS video:', err);
          setError('Error playing the video stream');
        });
        setIsLoading(false);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setError('Fatal HLS error — cannot recover');
              setIsLoading(false);
              hls.destroy();
          }
        }
      });

      return () => hls.destroy();
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = camera.url;
      const onMeta = () => {
        video.play().catch(() => setError('Error playing the video stream'));
        setIsLoading(false);
      };
      video.addEventListener('loadedmetadata', onMeta);
      return () => video.removeEventListener('loadedmetadata', onMeta);
    } else {
      setError('HLS is not supported in this browser');
      setIsLoading(false);
    }
  }, [camera.url, camera.type]);

  // ── MJPEG ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (camera.type !== 'mjpeg') return;
    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);
    setError(null);
    video.src = camera.url;
    setIsLoading(false);
  }, [camera.url, camera.type]);

  // ── WebRTC (WHEP) ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (camera.type !== 'webrtc') return;

    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);
    setError(null);

    let pc: RTCPeerConnection | null = null;
    let cancelled = false;

    const connect = async () => {
      try {
        pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });

        // We only want to receive audio + video.
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        // Attach incoming media tracks to the <video> element.
        pc.ontrack = (event) => {
          if (video && event.streams[0]) {
            video.srcObject = event.streams[0];
            video
              .play()
              .then(() => {
                if (!cancelled) setIsLoading(false);
              })
              .catch(() => {
                if (!cancelled) setError('Error playing the WebRTC stream');
              });
          }
        };

        // Create SDP offer.
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Wait for ICE gathering to complete (max 5 s).
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 5000);
          pc!.addEventListener('icegatheringstatechange', () => {
            if (pc!.iceGatheringState === 'complete') {
              clearTimeout(timeout);
              resolve();
            }
          });
          if (pc!.iceGatheringState === 'complete') {
            clearTimeout(timeout);
            resolve();
          }
        });

        // Send offer to WHEP endpoint; expect SDP answer.
        const response = await fetch(camera.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp', Accept: 'application/sdp' },
          body: pc.localDescription!.sdp,
        });

        if (!response.ok) {
          throw new Error(`WHEP endpoint returned ${response.status} ${response.statusText}`);
        }

        const sdpAnswer = await response.text();
        await pc.setRemoteDescription({ type: 'answer', sdp: sdpAnswer });
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'WebRTC connection failed';
          console.error('[VideoPlayer] WebRTC error:', err);
          setError(msg);
          setIsLoading(false);
        }
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (pc) {
        pc.close();
      }
      if (video) {
        video.srcObject = null;
      }
    };
  }, [camera.url, camera.type]);

  // ── WebSocket / fMP4 (MSE) ────────────────────────────────────────────────────
  useEffect(() => {
    if (camera.type !== 'ws') return;

    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);
    setError(null);

    let ws: WebSocket | null = null;
    let mediaSource: MediaSource | null = null;
    let sourceBuffer: SourceBuffer | null = null;
    const queue: ArrayBuffer[] = [];
    let objectURL: string | null = null;

    const appendNext = () => {
      if (!sourceBuffer || sourceBuffer.updating || queue.length === 0) return;
      try {
        sourceBuffer.appendBuffer(queue.shift()!);
      } catch (e) {
        console.error('[VideoPlayer] MSE appendBuffer error:', e);
      }
    };

    const setupMSE = () => {
      // Determine MIME type — prefer what the server provided, fall back to H.264 baseline.
      const mimeType = 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"';

      if (!MediaSource.isTypeSupported(mimeType)) {
        setError('Your browser does not support MSE with H.264 (required for WebSocket streams)');
        setIsLoading(false);
        return;
      }

      mediaSource = new MediaSource();
      objectURL = URL.createObjectURL(mediaSource);
      video.src = objectURL;

      mediaSource.addEventListener('sourceopen', () => {
        if (!mediaSource || mediaSource.readyState !== 'open') return;
        try {
          sourceBuffer = mediaSource.addSourceBuffer(mimeType);
          sourceBuffer.mode = 'segments';
          sourceBuffer.addEventListener('updateend', appendNext);
        } catch (e) {
          console.error('[VideoPlayer] MediaSource addSourceBuffer error:', e);
          setError('Failed to initialise MediaSource SourceBuffer');
          setIsLoading(false);
        }
      });
    };

    setupMSE();

    ws = new WebSocket(camera.url);
    ws.binaryType = 'arraybuffer';

    let started = false;  // local flag inside the effect closure

    ws.onopen = () => {
      console.log(`[VideoPlayer] WS connected: ${camera.url}`);
    };

    ws.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      queue.push(event.data);
      appendNext();

      if (!started) {
        started = true;
        video
          .play()
          .then(() => setIsLoading(false))
          .catch(() => {
            // Autoplay may be blocked; the user can click play.
            setIsLoading(false);
          });
      }
    };

    ws.onerror = () => {
      setError('WebSocket connection error — is the backend running?');
      setIsLoading(false);
    };

    ws.onclose = () => {
      console.log('[VideoPlayer] WS closed');
    };

    return () => {
      if (ws) ws.close();
      if (mediaSource && mediaSource.readyState === 'open') {
        try {
          mediaSource.endOfStream();
        } catch {
          // ignore
        }
      }
      if (objectURL) {
        URL.revokeObjectURL(objectURL);
        video.src = '';
      }
    };
  }, [camera.url, camera.type]);

  // ── Generic / direct video URL ────────────────────────────────────────────────
  useEffect(() => {
    if (!['rtsp', 'mjpeg', 'hls', 'webrtc', 'ws'].includes(camera.type) && camera.url) {
      const video = videoRef.current;
      if (!video) return;

      setIsLoading(true);
      setError(null);

      video.src = camera.url;
      const onMeta = () => setIsLoading(false);
      const onErr = () => {
        setError('Failed to load video');
        setIsLoading(false);
      };
      video.addEventListener('loadedmetadata', onMeta);
      video.addEventListener('error', onErr);
      return () => {
        video.removeEventListener('loadedmetadata', onMeta);
        video.removeEventListener('error', onErr);
      };
    }
  }, [camera.url, camera.type]);

  // ── RTSP warning ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (camera.type === 'rtsp') {
      setError(
        'Direct RTSP playback is not supported in browsers. ' +
          'Add the camera using the RTSP auto-convert option to stream via HLS or WebSocket.'
      );
      setIsLoading(false);
    }
  }, [camera.type]);

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden shadow-lg group">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-white" />
            <h3 className="text-white text-sm font-medium truncate">{camera.name}</h3>
          </div>
          <button
            onClick={() => onRemove(camera.id)}
            className="p-1.5 bg-red-500/80 hover:bg-red-600 rounded-md transition-colors"
            title="Remove camera"
          >
            <Trash2 className="w-4 h-4 text-white" />
          </button>
        </div>
        <p className="text-xs text-gray-300 mt-1 truncate">{camera.url}</p>
      </div>

      {/* Video */}
      <div className="aspect-video bg-gray-800 flex items-center justify-center">
        {error ? (
          <div className="flex flex-col items-center gap-2 text-red-400 p-4 text-center">
            <VideoOff className="w-12 h-12" />
            <p className="text-sm">{error}</p>
            <p className="text-xs text-gray-400">Check the URL and stream type</p>
          </div>
        ) : (
          <>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm text-gray-400">Loading stream…</p>
                </div>
              </div>
            )}
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              controls
              muted
              playsInline
            />
          </>
        )}
      </div>

      {/* Type indicator */}
      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white uppercase">
        {camera.type === 'ws' ? 'WS' : camera.type}
      </div>
    </div>
  );
}
