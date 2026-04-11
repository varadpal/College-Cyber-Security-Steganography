const API_BASE = 'http://localhost:3001/api';

// ── Existing API ──────────────────────────────────────────────────────────────

/**
 * Encode a message into a cover image via the backend.
 * Supports optional AES-256 password and EXIF metadata scrubbing.
 */
export async function encodeMessage(
  image: File,
  message: string,
  password?: string,
  scrubMetadata?: boolean
): Promise<Blob> {
  const form = new FormData();
  form.append('image', image);
  form.append('message', message);
  if (password) form.append('password', password);
  if (scrubMetadata) form.append('scrubMetadata', 'true');

  const res = await fetch(`${API_BASE}/encode`, { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Encode failed (${res.status})`);
  }
  return res.blob();
}

/**
 * Decode a hidden message from an encoded image.
 * Supports optional AES-256 password for encrypted messages.
 */
export async function decodeMessage(image: File, password?: string): Promise<string> {
  const form = new FormData();
  form.append('image', image);
  if (password) form.append('password', password);

  const res = await fetch(`${API_BASE}/decode`, { method: 'POST', body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Decode failed (${res.status})`);
  return body.message as string;
}

// ── Analysis / Forensics API ──────────────────────────────────────────────────

export interface AnalysisResponse {
  mse: number;
  psnr: number;
  changed_pixels: number;
  percent_changed: number;
  dimensions: string;
  heatmap: string; // base64 data URL
}

/** Compare original vs encoded image — returns heatmap + metrics */
export async function analyzeImages(original: File, encoded: File): Promise<AnalysisResponse> {
  const form = new FormData();
  form.append('original', original);
  form.append('encoded', encoded);

  const res = await fetch(`${API_BASE}/analyze`, { method: 'POST', body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Analysis failed (${res.status})`);
  return body as AnalysisResponse;
}

export interface AnalysisV2Response {
  found: boolean;
  bbox?: [number, number, number, number];
  metrics?: {
    mse: number;
    psnr: number;
    changed_pixels: number;
    percent_changed: number;
    dimensions: string;
    payload_dim: string;
  };
  annotated_image?: string; // base64
  logic_steps: string[];
  message?: string;
}

/** 
 * Deep Scan: Region Discovery — compares images, finds bounding box
 * and provides mathematical reasoning logic.
 */
export async function analyzeImagesV2(original: File, encoded: File): Promise<AnalysisV2Response> {
  const form = new FormData();
  form.append('original', original);
  form.append('encoded', encoded);

  const res = await fetch(`${API_BASE}/analyze-v2`, { method: 'POST', body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Deep Scan failed (${res.status})`);
  return body as AnalysisV2Response;
}

// ── New API — Non-Breaking Additions ─────────────────────────────────────────

export interface StegdetectChannel {
  channel: string;
  chi_sq: number;
  confidence: number;
}

export interface StegdetectResponse {
  verdict: 'LIKELY_ENCODED' | 'INCONCLUSIVE' | 'LIKELY_CLEAN';
  assessment: string;
  avg_confidence: number;
  channels: StegdetectChannel[];
}

/**
 * Chi-Square Steganalysis Attack — statistically detect if an image
 * is likely to contain hidden data (without needing the password).
 */
export async function stegdetect(image: File): Promise<StegdetectResponse> {
  const form = new FormData();
  form.append('image', image);

  const res = await fetch(`${API_BASE}/stegdetect`, { method: 'POST', body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Stegdetect failed (${res.status})`);
  return body as StegdetectResponse;
}

export interface HashResponse {
  sha256: string;
  size_bytes: number;
  format: string;
  dimensions: string;
  mode: string;
  capacity_chars: number;
}

/**
 * Compute SHA-256 hash and extract image metadata.
 * Used for integrity verification and capacity estimation.
 */
export async function hashImage(image: File): Promise<HashResponse> {
  const form = new FormData();
  form.append('image', image);

  const res = await fetch(`${API_BASE}/hash`, { method: 'POST', body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Hash failed (${res.status})`);
  return body as HashResponse;
}
