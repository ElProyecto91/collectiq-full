import type { RecognitionProvider, RecognitionResult, RecognitionInput } from './recognition-provider.interface';

/**
 * Scanner service — orchestrates the camera + recognition flow.
 *
 * The scanner UI calls this service to run a scan; it coordinates capturing a
 * frame (camera service) and recognizing it (a registered RecognitionProvider).
 * Today no provider is registered, so `scan` throws a typed error — the
 * architecture is ready for the first AI provider to be plugged in.
 */
class ScannerService {
  private provider: RecognitionProvider | null = null;

  /** Register the active recognition provider (composition root calls this). */
  registerProvider(provider: RecognitionProvider): void {
    this.provider = provider;
  }

  hasProvider(): boolean {
    return this.provider !== null;
  }

  async scan(input: RecognitionInput): Promise<RecognitionResult> {
    if (!this.provider) {
      throw new Error('No recognition provider is configured yet');
    }
    return this.provider.recognize(input);
  }
}

export const scannerService = new ScannerService();
