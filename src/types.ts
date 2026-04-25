export interface Camera {
  id: string;
  name: string;
  url: string;
  /**
   * Stream type:
   *  - hls      → HTTP Live Streaming (.m3u8), served by the backend after RTSP→HLS conversion
   *  - mjpeg    → Motion-JPEG HTTP stream
   *  - webrtc   → Native WebRTC source (WHEP protocol); `url` is the WHEP HTTP endpoint
   *  - ws       → Low-latency fragmented MP4 over WebSocket (RTSP→fMP4 conversion by backend)
   *  - rtsp     → Direct RTSP URL (requires browser plugin or native support; use hls/ws instead)
   */
  type: 'rtsp' | 'hls' | 'mjpeg' | 'webrtc' | 'ws';
}

export interface CameraGridLayout {
  columns: number;
  rows: number;
}

export interface DiscoveredCamera {
  id: string;
  type: 'onvif' | 'tapo' | 'yi' | 'generic';
  name: string;
  manufacturer?: string;
  model?: string;
  ip?: string;
  address?: string;
  port?: number;
  onvifAddress?: string;
  deviceId?: string;
  macAddress?: string;
  firmwareVersion?: string;
  requiresAuth: boolean;
  rtspPorts?: number[];
  discovered: string;
  cloudConnected?: boolean;
  urn?: string;
  scopes?: string[];
}

export interface DiscoveryStatus {
  status: 'idle' | 'running' | 'completed' | 'error';
  progress: number;
  message: string;
  devicesFound: number;
  inProgress: boolean;
}

export interface CameraCredentials {
  username: string;
  password: string;
}

export interface DeviceInfo {
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  serialNumber?: string;
  hardwareId?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  error?: string;
  deviceInfo?: DeviceInfo;
  profiles?: Record<string, unknown>[];
  rtspPort?: number;
  message?: string;
  suggestedUrls?: string[];
}
