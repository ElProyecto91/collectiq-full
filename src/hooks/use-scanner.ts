// src/hooks/use-scanner.ts
import { useState, useCallback } from 'react';
import { ScanResult } from '../types/tcg';

function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

export function useScanner() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [validated, setValidated] = useState(false);
  const [scansRemaining, setScansRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(async (imageBase64: string, tcgHint?: string) => {
    setScanning(true);
    setError(null);
    setResult(null);

    try {
      const r = await fetch('/api/scanner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          image_base64: imageBase64,
          tcg_hint: tcgHint ?? null
        })
      });

      if (r.status === 429) {
        const d = await r.json();
        setError(`Límite alcanzado: ${d.scans_today}/${d.limit} escaneos hoy`);
        return null;
      }

      if (!r.ok) throw new Error('Error en el escáner');

      const d = await r.json();
      setResult(d.result);
      setValidated(d.validated);
      setScansRemaining(d.scans_remaining);
      return d.result;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setScanning(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setValidated(false);
    setError(null);
  }, []);

  return {
    scan, reset,
    scanning, result, validated,
    scansRemaining, error
  };
}