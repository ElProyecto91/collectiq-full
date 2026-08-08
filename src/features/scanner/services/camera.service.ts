/**
 * Camera service — abstraction over device camera access.
 *
 * Wraps `getUserMedia` so the scanner UI never touches browser APIs directly.
 * A future WebRTC/MediaDevices implementation lives behind this interface;
 * for now the methods are declared but throw `not implemented`, preserving the
 * contract for the scanner UI to be built against.
 */
export interface CameraFrame {
  /** Data URL of the captured still frame. */
  dataUrl: string;
  width: number;
  height: number;
}

export interface CameraConstraints {
  facingMode: 'environment' | 'user';
  idealWidth?: number;
  idealHeight?: number;
}

class CameraService {
  private stream: MediaStream | null = null;

  /** True if the current browser can access a camera. */
  isSupported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  async start(constraints: CameraConstraints = { facingMode: 'environment' }): Promise<MediaStream> {
    if (!this.isSupported()) {
      throw new Error('Camera is not supported on this device');
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: constraints.facingMode,
        width: { ideal: constraints.idealWidth ?? 1920 },
        height: { ideal: constraints.idealHeight ?? 1080 },
      },
      audio: false,
    });
    return this.stream;
  }

  async stop(): Promise<void> {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  /** Capture a still frame from a video element bound to the active stream. */
  capture(video: HTMLVideoElement): CameraFrame {
    if (!this.stream) throw new Error('Camera is not started');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1080;
    canvas.height = video.videoHeight || 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not capture frame');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.9), width: canvas.width, height: canvas.height };
  }
}

export const cameraService = new CameraService();
export type { CameraService };
