export interface Camera {
  id: string;
  name: string;
  url: string;
  type: 'rtsp' | 'hls' | 'mjpeg' | 'webrtc';
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

export interface ConnectionTestResult {
  success: boolean;
  error?: string;
  deviceInfo?: any;
  profiles?: any[];
  rtspPort?: number;
  message?: string;
}
