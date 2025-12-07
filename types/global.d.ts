declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }

  interface HTMLMediaElement {
    captureStream?: () => MediaStream;
    mozCaptureStream?: () => MediaStream;
    setSinkId?: (sinkId: string) => Promise<void>;
  }
}

export {};



