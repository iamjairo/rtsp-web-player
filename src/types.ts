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
