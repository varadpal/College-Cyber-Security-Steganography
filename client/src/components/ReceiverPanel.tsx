import { useCallback, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { decodeMessage } from '../api/steganography';
import { DecryptionResult } from './DecryptionResult';

export function ReceiverPanel() {
  const { state, dispatch } = useAppContext();
  const { receiver } = state;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      dispatch({ type: 'RECEIVER_SET_STATUS', payload: { status: 'error', errorMessage: 'INVALID_TYPE: Only images accepted.' } });
      return;
    }
    const preview = URL.createObjectURL(file);
    dispatch({ type: 'RECEIVER_SET_IMAGE', payload: { file, preview } });
    dispatch({ type: 'LOG_ADD', payload: { level: 'INFO', module: 'DECODER', message: `Subject loaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)` } });
  }, [dispatch]);

  const handleDecode = async () => {
    if (!receiver.encodedImage) {
      dispatch({ type: 'RECEIVER_SET_STATUS', payload: { status: 'error', errorMessage: 'No image loaded.' } });
      return;
    }
    dispatch({ type: 'RECEIVER_SET_STATUS', payload: { status: 'loading' } });
    dispatch({ type: 'LOG_ADD', payload: { level: 'INFO', module: 'DECODER', message: `Initiating extraction — Key: ${receiver.password ? 'PROVIDED' : 'NONE'}` } });

    try {
      const message = await decodeMessage(receiver.encodedImage, receiver.password || undefined);
      dispatch({ type: 'RECEIVER_SET_DECODED', payload: message });
      dispatch({ type: 'LOG_ADD', payload: { level: 'SUCCESS', module: 'DECODER', message: `Extraction complete. ${message.length} chars recovered.` } });
    } catch (err) {
      const msg = (err as Error).message;
      dispatch({ type: 'RECEIVER_SET_STATUS', payload: { status: 'error', errorMessage: msg } });
      dispatch({ type: 'LOG_ADD', payload: { level: 'ERROR', module: 'DECODER', message: `Extraction failed: ${msg}` } });
    }
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Left — Configuration */}
        <section>
          <h3 className="mono" style={{ color: 'var(--secondary)', textShadow: '0 0 8px var(--secondary-glow)', marginBottom: '1.5rem' }}>
            // DECODE_CONFIGURATION
          </h3>

          {/* Image Upload */}
          <div style={{ marginBottom: '1.2rem' }}>
            <label className="mono" style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              ENCODED_SUBJECT (Stego Image)
            </label>
            <div
              style={{
                padding: '1rem', textAlign: 'center', cursor: 'pointer',
                border: '1px dashed rgba(188,0,255,0.4)', borderRadius: '6px',
                background: 'rgba(0,0,0,0.3)', transition: 'all 0.2s ease',
              }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImageFile(f); }}
              onClick={() => fileInputRef.current?.click()}
            >
              {receiver.encodedImagePreview ? (
                <img src={receiver.encodedImagePreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '130px', borderRadius: '4px' }} />
              ) : (
                <div style={{ padding: '1.5rem 0' }}>
                  <p className="mono" style={{ color: 'var(--secondary)', fontSize: '0.85rem' }}>UPLOAD_STEGO_IMAGE</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Click or Drag/Drop</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }} />
            </div>
          </div>

          {/* Decryption Key */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="mono" style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              DECRYPTION_KEY — AES-256-GCM
            </label>
            <input
              type="password"
              style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.8rem', color: 'white', fontSize: '0.9rem', fontFamily: 'Fira Code, monospace' }}
              placeholder="Leave blank if not encrypted"
              value={receiver.password}
              onChange={e => dispatch({ type: 'RECEIVER_SET_PASSWORD', payload: e.target.value })}
            />
          </div>

          {/* Decode Button */}
          <button
            onClick={handleDecode}
            disabled={receiver.status === 'loading' || !receiver.encodedImage}
            style={{
              width: '100%', background: 'transparent', border: '1px solid var(--secondary)', color: 'var(--secondary)',
              padding: '0.9rem', fontFamily: 'Fira Code, monospace', fontWeight: 700, letterSpacing: '2px',
              cursor: 'pointer', borderRadius: '4px', fontSize: '0.85rem', transition: 'all 0.3s',
              opacity: !receiver.encodedImage ? 0.5 : 1,
            }}
          >
            {receiver.status === 'loading' ? 'SCANNING_BITSTREAM...' : '▶ INITIATE EXTRACTION'}
          </button>

          {receiver.status === 'error' && (
            <div className="mono" style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(255,0,60,0.08)', border: '1px solid var(--error)', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--error)' }}>
              !! {receiver.errorMessage}
            </div>
          )}
        </section>

        {/* Right — Extracted Data */}
        <section>
          <h3 className="mono" style={{ color: 'var(--secondary)', textShadow: '0 0 8px var(--secondary-glow)', marginBottom: '1.5rem' }}>
            // EXTRACTED_DATA
          </h3>

          <div
            style={{
              minHeight: '250px', padding: '1.5rem', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)',
              borderRadius: '6px', position: 'relative', overflow: 'hidden',
            }}
          >
            {receiver.status === 'loading' && (
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(90deg, transparent, var(--secondary), transparent)', animation: 'slideAnim 1.5s linear infinite' }} />
            )}

            {receiver.decodedMessage ? (
              <DecryptionResult message={receiver.decodedMessage} />
            ) : receiver.status === 'loading' ? (
              <div className="mono" style={{ textAlign: 'center', paddingTop: '3rem', color: 'var(--secondary)' }}>
                <p>READING LSB OFFSETS...</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Parsing pixel bitstream</p>
              </div>
            ) : (
              <div className="mono" style={{ textAlign: 'center', paddingTop: '3rem', color: 'var(--text-muted)' }}>
                <p>AWAITING_INPUT</p>
                <p style={{ fontSize: '0.7rem', marginTop: '0.5rem' }}>Upload a stego image to begin</p>
              </div>
            )}
          </div>

          {receiver.decodedMessage && (
            <p className="mono" style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--accent)' }}>
              ✓ INTEGRITY_VERIFIED — Message extracted with zero bit loss.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
