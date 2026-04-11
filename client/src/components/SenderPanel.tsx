import { useCallback, useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { encodeMessage, hashImage } from '../api/steganography';
import { ImagePreview } from './ImagePreview';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';

const MAX_CHARS = 2000;

export function SenderPanel() {
  const { state, dispatch } = useAppContext();
  const { sender } = state;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      dispatch({ type: 'SENDER_SET_STATUS', payload: { status: 'error', errorMessage: 'INVALID_TYPE: Only image files accepted.' } });
      dispatch({ type: 'LOG_ADD', payload: { level: 'ERROR', module: 'ENCODER', message: `Rejected file: ${file.name} — not an image.` } });
      return;
    }
    const preview = URL.createObjectURL(file);
    dispatch({ type: 'SENDER_SET_IMAGE', payload: { file, preview } });
    dispatch({ type: 'LOG_ADD', payload: { level: 'INFO', module: 'ENCODER', message: `Cover image loaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)` } });

    // Auto-fetch hash + capacity
    try {
      const hashInfo = await hashImage(file);
      dispatch({ type: 'SENDER_SET_HASH', payload: hashInfo });
      dispatch({ type: 'LOG_ADD', payload: { level: 'INFO', module: 'HASH_ENGINE', message: `SHA-256: ${hashInfo.sha256.slice(0, 16)}... | Capacity: ~${hashInfo.capacity_chars} chars` } });
    } catch {
      // non-critical — don't fail the upload
    }
  }, [dispatch]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  }, [handleImageFile]);

  const handleEncode = async () => {
    if (!sender.coverImage) {
      dispatch({ type: 'SENDER_SET_STATUS', payload: { status: 'error', errorMessage: 'Upload a cover image first.' } });
      return;
    }
    if (!sender.message.trim()) {
      dispatch({ type: 'SENDER_SET_STATUS', payload: { status: 'error', errorMessage: 'Message payload cannot be empty.' } });
      return;
    }

    dispatch({ type: 'SENDER_SET_STATUS', payload: { status: 'loading' } });
    dispatch({ type: 'LOG_ADD', payload: { level: 'INFO', module: 'ENCODER', message: `Initiating encode — ${sender.password ? 'AES-256 ENABLED' : 'No encryption'} | EXIF_SCRUB: ${sender.scrubMetadata}` } });

    try {
      const blob = await encodeMessage(sender.coverImage, sender.message, sender.password || undefined, sender.scrubMetadata);
      const url = URL.createObjectURL(blob);
      dispatch({ type: 'SENDER_SET_ENCODED', payload: url });
      dispatch({ type: 'LOG_ADD', payload: { level: 'SUCCESS', module: 'ENCODER', message: `Encode complete. Payload: ${sender.message.length} chars embedded into ${sender.coverImage.name}.` } });

      const a = document.createElement('a');
      a.href = url;
      a.download = 'steganovault_packaged.png';
      a.click();
    } catch (err) {
      const msg = (err as Error).message;
      dispatch({ type: 'SENDER_SET_STATUS', payload: { status: 'error', errorMessage: msg } });
      dispatch({ type: 'LOG_ADD', payload: { level: 'ERROR', module: 'ENCODER', message: `Encode failed: ${msg}` } });
    }
  };

  const charsLeft = MAX_CHARS - sender.message.length;
  const capacityUsed = sender.coverHash ? Math.min(100, Math.round((sender.message.length / sender.coverHash.capacity_chars) * 100)) : 0;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Left — Configuration */}
        <section>
          <h3 className="mono" style={{ color: 'var(--primary)', textShadow: '0 0 8px var(--primary-glow)', marginBottom: '1.5rem' }}>
            // ENCODE_CONFIGURATION
          </h3>

          {/* Image Upload */}
          <div style={{ marginBottom: '1.2rem' }}>
            <label className="mono" style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              COVER_MATRIX (Target Image)
            </label>
            <div
              style={{
                padding: '1rem',
                textAlign: 'center',
                cursor: 'pointer',
                border: `1px dashed ${dragOver ? 'var(--primary)' : 'rgba(0,242,255,0.3)'}`,
                borderRadius: '6px',
                background: dragOver ? 'rgba(0,242,255,0.05)' : 'rgba(0,0,0,0.3)',
                transition: 'all 0.2s ease',
              }}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {sender.coverImagePreview ? (
                <img src={sender.coverImagePreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '130px', borderRadius: '4px' }} />
              ) : (
                <div style={{ padding: '1.5rem 0' }}>
                  <p className="mono" style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>UPLOAD_TARGET_IMAGE</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Click or Drag/Drop • PNG, JPG, BMP</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }} />
            </div>

            {/* Image Metadata + Hash */}
            {sender.coverHash && (
              <div className="mono" style={{ marginTop: '0.5rem', padding: '0.6rem', background: 'rgba(0,0,0,0.4)', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '0.7rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>DIMS:</span>
                <span style={{ color: 'var(--primary)' }}>{sender.coverHash.dimensions}</span>
                <span style={{ color: 'var(--text-muted)' }}>FORMAT:</span>
                <span>{sender.coverHash.format} / {sender.coverHash.mode}</span>
                <span style={{ color: 'var(--text-muted)' }}>CAPACITY:</span>
                <span style={{ color: 'var(--accent)' }}>~{sender.coverHash.capacity_chars} chars</span>
                <span style={{ color: 'var(--text-muted)' }}>SHA-256:</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--secondary)', wordBreak: 'break-all' }}>{sender.coverHash.sha256.slice(0, 20)}...</span>
              </div>
            )}
          </div>

          {/* Message */}
          <div style={{ marginBottom: '1.2rem' }}>
            <label className="mono" style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              SECRET_PAYLOAD — {charsLeft} chars remaining
            </label>
            <textarea
              style={{
                width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: '6px',
                padding: '0.8rem', color: 'white', fontSize: '0.9rem', fontFamily: 'Fira Code, monospace', resize: 'vertical',
              }}
              rows={4}
              value={sender.message}
              maxLength={MAX_CHARS}
              placeholder="Enter covert text here..."
              onChange={e => dispatch({ type: 'SENDER_SET_MESSAGE', payload: e.target.value })}
            />
            {/* Capacity Usage Bar */}
            {sender.coverHash && sender.message.length > 0 && (
              <div style={{ marginTop: '0.3rem' }}>
                <div style={{ height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
                  <div style={{ height: '100%', width: `${capacityUsed}%`, background: capacityUsed > 80 ? 'var(--error)' : 'var(--accent)', borderRadius: '2px', transition: 'width 0.3s' }} />
                </div>
                <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>CAPACITY USED: {capacityUsed}%</span>
              </div>
            )}
          </div>

          {/* Security Key */}
          <div style={{ marginBottom: '1.2rem' }}>
            <label className="mono" style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              SECURITY_KEY — AES-256-GCM Encryption
            </label>
            <input
              type="password"
              style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.8rem', color: 'white', fontSize: '0.9rem', fontFamily: 'Fira Code, monospace' }}
              placeholder="Optional — leave blank for unencrypted"
              value={sender.password}
              onChange={e => dispatch({ type: 'SENDER_SET_PASSWORD', payload: e.target.value })}
            />
            <PasswordStrengthMeter password={sender.password} />
          </div>

          {/* Metadata Scrub toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <input
              type="checkbox"
              id="scrub-meta"
              checked={sender.scrubMetadata}
              onChange={e => {
                dispatch({ type: 'SENDER_TOGGLE_METADATA', payload: e.target.checked });
                dispatch({ type: 'LOG_ADD', payload: { level: 'INFO', module: 'EXIF_ENGINE', message: `Metadata scrubbing ${e.target.checked ? 'ENABLED' : 'DISABLED'}.` } });
              }}
              style={{ transform: 'scale(1.3)', accentColor: 'var(--primary)' }}
            />
            <label htmlFor="scrub-meta" className="mono" style={{ fontSize: '0.8rem', cursor: 'pointer' }}>
              SCRUB_EXIF_METADATA — Remove GPS, camera, timestamps
            </label>
          </div>

          {/* Encode Button */}
          <button
            onClick={handleEncode}
            disabled={sender.status === 'loading'}
            style={{
              width: '100%', background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)',
              padding: '0.9rem', fontFamily: 'Fira Code, monospace', fontWeight: 700, letterSpacing: '2px',
              cursor: sender.status === 'loading' ? 'wait' : 'pointer', borderRadius: '4px', fontSize: '0.85rem',
              transition: 'all 0.3s', boxShadow: sender.status === 'loading' ? '0 0 15px var(--primary-glow)' : 'none',
            }}
          >
            {sender.status === 'loading' ? 'EXECUTING_ENCODE_SEQUENCE...' : '▶ EXECUTE ENCODE'}
          </button>

          {sender.status === 'error' && (
            <div className="mono" style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(255,0,60,0.08)', border: '1px solid var(--error)', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--error)' }}>
              !! {sender.errorMessage}
            </div>
          )}
        </section>

        {/* Right — Visual Output */}
        <section>
          <h3 className="mono" style={{ color: 'var(--primary)', textShadow: '0 0 8px var(--primary-glow)', marginBottom: '1.5rem' }}>
            // VISUAL_OUTPUT
          </h3>

          <ImagePreview originalSrc={sender.coverImagePreview} encodedSrc={sender.encodedImageUrl} />

          {sender.encodedImageUrl && (
            <div className="mono" style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(0,242,255,0.05)', border: '1px solid var(--primary)', borderRadius: '6px' }}>
              <p style={{ color: 'var(--accent)', marginBottom: '0.5rem' }}>✓ ENCODE_SEQUENCE_COMPLETE</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                LSB-3 algorithm applied. Pixel deviation &lt; 0.1% — imperceptible to human vision.
              </p>
              <a
                href={sender.encodedImageUrl}
                download="steganovault_packaged.png"
                style={{
                  display: 'block', textAlign: 'center', padding: '0.75rem', background: 'transparent',
                  border: '1px solid var(--secondary)', color: 'var(--secondary)', textDecoration: 'none',
                  borderRadius: '4px', letterSpacing: '1px', fontSize: '0.8rem',
                }}
              >
                ⬇ GENERATE HARD_COPY
              </a>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
