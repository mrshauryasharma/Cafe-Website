/**
 * Cross-Platform NFC Detection & Input Normalization Utility
 * Supports Web NFC (Android Chrome) and iOS background NDEF tag reading.
 */

export interface NfcCapabilities {
  hasWebNfc: boolean;
  isIos: boolean;
  isAndroid: boolean;
}

/**
 * Detects whether the current device supports Web NFC (Android Chrome)
 * or requires native background NDEF tag reading (iOS Safari / PWA).
 */
export function detectNfcCapabilities(): NfcCapabilities {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { hasWebNfc: false, isIos: false, isAndroid: false };
  }

  const hasWebNfc = 'NDEFReader' in window;
  const ua = navigator.userAgent || '';
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);

  return { hasWebNfc, isIos, isAndroid };
}

/**
 * Normalizes card inputs from direct keyboard entry, barcode/QR/URL paste,
 * or shorthand numbers (e.g. "1" or "001" -> "GROVE-001").
 */
export function normalizeCardInput(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.trim();

  // 1. If a full scan URL is pasted/scanned (e.g., https://the-grove-cafe.pages.dev/scan/GROVE-001)
  if (cleaned.includes('/scan/')) {
    const parts = cleaned.split('/scan/');
    if (parts[1]) {
      cleaned = parts[1].split(/[?#\/]/)[0];
    }
  } else if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    try {
      const url = new URL(cleaned);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const scanIdx = pathParts.indexOf('scan');
      if (scanIdx !== -1 && pathParts[scanIdx + 1]) {
        cleaned = pathParts[scanIdx + 1];
      } else if (pathParts.length > 0) {
        cleaned = pathParts[pathParts.length - 1];
      }
    } catch {
      // ignore URL parsing error
    }
  }

  cleaned = cleaned.trim().toUpperCase();

  // 2. Shorthand numeric entry like "1", "01", "001", "42", "300"
  if (/^\d{1,4}$/.test(cleaned)) {
    const num = parseInt(cleaned, 10);
    const padded = String(num).padStart(3, '0');
    return `GROVE-${padded}`;
  }

  // 3. Shorthand with GROVE prefix like "GROVE1" or "GROVE-1"
  const groveMatch = cleaned.match(/^GROVE[-_ ]?(\d{1,4})$/i);
  if (groveMatch && groveMatch[1]) {
    const num = parseInt(groveMatch[1], 10);
    const padded = String(num).padStart(3, '0');
    return `GROVE-${padded}`;
  }

  // 4. Default: remove invalid characters while retaining valid hyphens/alphanumerics
  return cleaned.replace(/[^A-Z0-9_-]/g, '');
}
