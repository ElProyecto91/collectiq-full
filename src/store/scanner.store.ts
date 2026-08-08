import { create } from 'zustand';

/**
 * Scanner store — orchestration state for the card-scanning flow.
 *
 * The scanner is a multi-step state machine: idle → capturing → recognizing →
 * result. The actual camera and recognition work live in the scanner service
 * and camera service; this store holds only the state transitions and the last
 * result so the UI can render each step without prop-drilling.
 */
export type ScannerPhase = 'idle' | 'capturing' | 'recognizing' | 'result' | 'error';

interface ScannerState {
  phase: ScannerPhase;
  /** Base64/data-URL of the captured frame, kept for the result preview. */
  capturedImage: string | null;
  /** Processed (resized + compressed) image data URL, ready for recognition. */
  processedImage: string | null;
  /** Error message shown in the error phase; cleared on reset. */
  error: string | null;

  setPhase: (phase: ScannerPhase) => void;
  setCapturedImage: (image: string | null) => void;
  setProcessedImage: (image: string | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useScannerStore = create<ScannerState>((set) => ({
  phase: 'idle',
  capturedImage: null,
  processedImage: null,
  error: null,

  setPhase: (phase) => set({ phase }),
  setCapturedImage: (capturedImage) => set({ capturedImage }),
  setProcessedImage: (processedImage) => set({ processedImage }),
  setError: (error) => set({ error, phase: error ? 'error' : 'idle' }),
  reset: () => set({ phase: 'idle', capturedImage: null, processedImage: null, error: null }),
}));
