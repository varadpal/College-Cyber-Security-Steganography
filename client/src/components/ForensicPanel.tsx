import { useState, useRef, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { analyzeImages, analyzeImagesV2, stegdetect } from '../api/steganography';

export function ForensicPanel() {
  const { state, dispatch } = useAppContext();
  const { analysis } = state;

  // Left-side differential analysis state
  const [origFile, setOrigFile] = useState<File | null>(null);
  const [encFile, setEncFile]   = useState<File | null>(null);
  const [origPreview, setOrigPreview] = useState<string | null>(null);
  const [encPreview, setEncPreview]   = useState<string | null>(null);

  // Right-side auto-detect state
  const [detectFile, setDetectFile]     = useState<File | null>(null);
  const [detectPreview, setDetectPreview] = useState<string | null>(null);
  const detectRef = useRef<HTMLInputElement>(null);

  // ── Handlers — left side ─────────────────────────────────────────────────
  const handleOrigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setOrigFile(file); setOrigPreview(URL.createObjectURL(file)); }
  };
  const handleEncChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setEncFile(file); setEncPreview(URL.createObjectURL(file)); }
  };

  const handleAnalyze = async () => {
    if (!origFile || !encFile) return;
    dispatch({ type: 'ANALYSIS_SET_STATUS', payload: { status: 'loading' } });
    dispatch({ type: 'LOG_ADD', payload: { level: 'INFO', module: 'FORENSICS', message: `Differential scan: ${origFile.name} vs ${encFile.name}` } });
    try {
      const result = await analyzeImages(origFile, encFile);
      dispatch({ type: 'ANALYSIS_SET_RESULT', payload: { metrics: result, heatmap: result.heatmap } });
      dispatch({ type: 'LOG_ADD', payload: { level: 'SUCCESS', module: 'FORENSICS', message: `Scan complete — PSNR: ${result.psnr}dB | MSE: ${result.mse}` } });
    } catch (err) {
      const msg = (err as Error).message;
      dispatch({ type: 'ANALYSIS_SET_STATUS', payload: { status: 'error', errorMessage: msg } });
      dispatch({ type: 'LOG_ADD', payload: { level: 'ERROR', module: 'FORENSICS', message: `Scan failed: ${msg}` } });
    }
  };

  const handleDeepScan = async () => {
    if (!origFile || !encFile) return;
    dispatch({ type: 'ANALYSIS_SET_DEEP_SCAN_STATUS', payload: 'loading' });
    dispatch({ type: 'LOG_ADD', payload: { level: 'INFO', module: 'DEEP_SCAN', message: 'Region discovery & logic engine initiated.' } });
    try {
      const result = await analyzeImagesV2(origFile, encFile);
      dispatch({ type: 'ANALYSIS_SET_DEEP_SCAN', payload: result });
      dispatch({ type: 'LOG_ADD', payload: { level: 'SUCCESS', module: 'DEEP_SCAN', message: `Region discovery complete — Payload: ${result.metrics?.payload_dim}` } });
    } catch (err) {
      const msg = (err as Error).message;
      dispatch({ type: 'ANALYSIS_SET_DEEP_SCAN_STATUS', payload: 'error' });
      dispatch({ type: 'LOG_ADD', payload: { level: 'ERROR', module: 'DEEP_SCAN', message: `Deep scan failed: ${msg}` } });
    }
  };

  // ── Handler — right side auto-detect ────────────────────────────────────
  const runStegdetect = useCallback(async (file: File) => {
    dispatch({ type: 'ANALYSIS_SET_STEGDETECT_STATUS', payload: 'loading' });
    dispatch({ type: 'LOG_ADD', payload: { level: 'INFO', module: 'STEGDETECT', message: `Auto-analysing ${file.name} for hidden data…` } });
    try {
      const result = await stegdetect(file);
      dispatch({ type: 'ANALYSIS_SET_STEGDETECT', payload: result });
      dispatch({
        type: 'LOG_ADD',
        payload: {
          level: result.verdict === 'LIKELY_ENCODED' ? 'WARN' : 'SUCCESS',
          module: 'STEGDETECT',
          message: `Verdict: ${result.verdict} | Confidence: ${result.avg_confidence}%`,
        },
      });
    } catch (err) {
      const msg = (err as Error).message;
      dispatch({ type: 'ANALYSIS_SET_STEGDETECT_STATUS', payload: 'error' });
      dispatch({ type: 'LOG_ADD', payload: { level: 'ERROR', module: 'STEGDETECT', message: `Auto-detect failed: ${msg}` } });
    }
  }, [dispatch]);

  const handleDetectUpload = (file: File) => {
    setDetectFile(file);
    setDetectPreview(URL.createObjectURL(file));
    // Reset previous result then run
    dispatch({ type: 'ANALYSIS_SET_STEGDETECT_STATUS', payload: 'idle' });
    setTimeout(() => runStegdetect(file), 80);
  };

  // ── Verdict helpers ──────────────────────────────────────────────────────
  const r = analysis.stegdetectResult;
  const v = r?.verdict;
  const isEncoded      = v === 'LIKELY_ENCODED';
  const isInconclusive = v === 'INCONCLUSIVE';
  const vc    = isEncoded ? 'var(--error)' : isInconclusive ? '#ffd700' : 'var(--accent)';
  const vcRgb = isEncoded ? '255,0,60'    : isInconclusive ? '255,215,0' : '0,255,65';

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '2rem' }}>

        {/* ══ LEFT: Differential Pixel Analysis ═════════════════════════════ */}
        <section>
          <h3 className="mono" style={{ color: 'var(--primary)', textShadow: '0 0 8px var(--primary-glow)', marginBottom: '1.5rem' }}>
            // DIFFERENTIAL_PIXEL_ANALYSIS
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            {/* Subject A */}
            <div>
              <label className="mono" style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>SUBJECT_A [ORIGINAL]</label>
              <div
                style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px dashed var(--border)', borderRadius: '4px', background: 'rgba(0,0,0,0.3)', overflow: 'hidden' }}
                onClick={() => document.getElementById('orig-input')?.click()}
              >
                {origPreview
                  ? <img src={origPreview} alt="A" style={{ maxHeight: '90px', maxWidth: '100%' }} />
                  : <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>CLICK_TO_LOAD</span>}
                <input id="orig-input" type="file" hidden onChange={handleOrigChange} />
              </div>
            </div>
            {/* Subject B */}
            <div>
              <label className="mono" style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>SUBJECT_B [ENCODED]</label>
              <div
                style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px dashed var(--border)', borderRadius: '4px', background: 'rgba(0,0,0,0.3)', overflow: 'hidden' }}
                onClick={() => document.getElementById('enc-input')?.click()}
              >
                {encPreview
                  ? <img src={encPreview} alt="B" style={{ maxHeight: '90px', maxWidth: '100%' }} />
                  : <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>CLICK_TO_LOAD</span>}
                <input id="enc-input" type="file" hidden onChange={handleEncChange} />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button onClick={handleAnalyze} disabled={analysis.status === 'loading' || !origFile || !encFile} className="mono"
              style={{ flex: 1, background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '0.75rem', cursor: 'pointer', borderRadius: '4px', fontSize: '0.72rem', letterSpacing: '1px', opacity: (!origFile || !encFile) ? 0.45 : 1 }}>
              ▶  RUN FORENSIC SCAN
            </button>
            <button onClick={handleDeepScan} disabled={analysis.deepScanStatus === 'loading' || !origFile || !encFile} className="mono"
              style={{ flex: 1, background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)', padding: '0.75rem', cursor: 'pointer', borderRadius: '4px', fontSize: '0.72rem', letterSpacing: '1px', opacity: (!origFile || !encFile) ? 0.45 : 1 }}>
              🔍  DEEP REGION SCAN
            </button>
          </div>

          {/* Basic metrics */}
          {analysis.metrics && (
            <div className="mono" style={{ padding: '0.9rem', background: 'rgba(0,242,255,0.04)', border: '1px solid var(--primary)', borderRadius: '6px', fontSize: '0.78rem', marginBottom: '1rem' }}>
              <div style={{ color: 'var(--primary)', marginBottom: '0.6rem', fontWeight: 700 }}>BASIC_SCAN_METRICS:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                <div>MSE: <span style={{ color: 'var(--primary)' }}>{analysis.metrics.mse}</span></div>
                <div>PSNR: <span style={{ color: 'var(--accent)' }}>{analysis.metrics.psnr} dB</span></div>
                <div>CHANGED: <span style={{ color: 'var(--secondary)' }}>{analysis.metrics.changed_pixels} px</span></div>
                <div>DENSITY: <span style={{ color: 'var(--text-main)' }}>{analysis.metrics.percent_changed}%</span></div>
              </div>
            </div>
          )}

          {/* Deep Scan results */}
          {analysis.deepScanResult?.found && (
            <div className="mono" style={{ border: '1px solid var(--accent)', borderRadius: '8px', overflow: 'hidden', animation: 'revealSlide 0.4s ease' }}>
              <div style={{ background: 'rgba(0,255,65,0.1)', padding: '0.6rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,255,65,0.2)' }}>
                <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '0.75rem' }}>⚡ REGION_DISCOVERY_RESULT</span>
                <span style={{ background: 'var(--accent)', color: 'black', padding: '1px 6px', borderRadius: '4px', fontSize: '0.62rem' }}>V2</span>
              </div>
              <div style={{ padding: '1rem' }}>
                <img src={analysis.deepScanResult.annotated_image} alt="Annotated Scan" style={{ maxWidth: '100%', borderRadius: '4px', marginBottom: '0.75rem', display: 'block' }} />
                {/* Logic terminal */}
                <div style={{ background: '#000', padding: '0.65rem', borderRadius: '4px', border: '1px solid var(--border)', marginBottom: '0.75rem' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.6rem', marginBottom: '0.4rem' }}>• ENGINE: FORENSIC_CALCULATION_LOG</div>
                  {analysis.deepScanResult.logic_steps.map((step: string, i: number) => (
                    <div key={i} style={{ fontSize: '0.68rem', color: '#00ff41', marginBottom: '0.18rem', fontFamily: 'Fira Code' }}>
                      <span style={{ color: 'var(--text-muted)' }}>[{i + 1}]</span> {step}
                    </div>
                  ))}
                </div>
                {/* Coordinates */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', fontSize: '0.72rem' }}>
                  <div style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '4px' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>BOUNDING_COORDS</div>
                    <span style={{ color: 'var(--accent)' }}>({analysis.deepScanResult.bbox[0]},{analysis.deepScanResult.bbox[1]}) → ({analysis.deepScanResult.bbox[2]},{analysis.deepScanResult.bbox[3]})</span>
                  </div>
                  <div style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '4px' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>PAYLOAD_AREA</div>
                    <span style={{ color: 'var(--primary)' }}>{analysis.deepScanResult.metrics.payload_dim}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Legacy heatmap fallback */}
          {analysis.heatmapUrl && !analysis.deepScanResult && (
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <img src={analysis.heatmapUrl} alt="Forensic Heatmap" style={{ maxWidth: '100%', borderRadius: '4px', border: '1px solid var(--error)' }} />
              <p className="mono" style={{ fontSize: '0.65rem', marginTop: '0.3rem', color: 'var(--error)' }}>HEATMAP: PIXEL_VARIANCE_DETECTED</p>
            </div>
          )}
        </section>

        {/* ══ RIGHT: Auto Hidden-Message Detector ═══════════════════════════ */}
        <section>
          <h3 className="mono" style={{ color: 'var(--secondary)', textShadow: '0 0 8px var(--secondary-glow)', marginBottom: '0.4rem' }}>
            // HIDDEN_MESSAGE_DETECTOR
          </h3>
          <p className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.65 }}>
            Drop any image — the system instantly runs a Chi-Square statistical test on its LSB distribution to determine if a hidden message is embedded.
          </p>

          {/* Upload Zone */}
          <div
            onClick={() => detectRef.current?.click()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleDetectUpload(f); }}
            onDragOver={e => e.preventDefault()}
            style={{
              cursor: 'pointer',
              border: `2px dashed ${analysis.stegdetectStatus === 'loading' ? 'var(--secondary)' : 'rgba(188,0,255,0.45)'}`,
              borderRadius: '10px',
              background: 'rgba(188,0,255,0.04)',
              padding: '1rem',
              textAlign: 'center',
              transition: 'all 0.2s ease',
              marginBottom: '1.25rem',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Animated scan-line while loading */}
            {analysis.stegdetectStatus === 'loading' && (
              <div style={{
                position: 'absolute', left: 0, right: 0, height: '2px',
                background: 'linear-gradient(90deg, transparent, var(--secondary), transparent)',
                animation: 'scanDown 1.1s linear infinite', top: 0,
              }} />
            )}

            {detectPreview ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src={detectPreview} alt="Target" style={{ maxHeight: '130px', maxWidth: '100%', borderRadius: '6px', display: 'block' }} />
                {analysis.stegdetectStatus === 'loading' && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(188,0,255,0.18)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="mono" style={{ color: 'var(--secondary)', fontSize: '0.72rem', letterSpacing: 2 }}>SCANNING…</span>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '1.25rem 0' }}>
                <div style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>🔍</div>
                <p className="mono" style={{ color: 'var(--secondary)', fontSize: '0.85rem', marginBottom: '0.3rem' }}>DROP IMAGE HERE</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>or click to browse — analysis runs instantly</p>
              </div>
            )}

            <input
              ref={detectRef}
              type="file"
              accept="image/*"
              hidden
              onChange={e => { const f = e.target.files?.[0]; if (f) handleDetectUpload(f); }}
            />
          </div>

          {/* ── Scanning indicator ── */}
          {analysis.stegdetectStatus === 'loading' && (
            <div className="mono" style={{ padding: '1.25rem', textAlign: 'center', border: '1px solid rgba(188,0,255,0.35)', borderRadius: '8px', background: 'rgba(188,0,255,0.05)',  marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--secondary)', letterSpacing: 3 }}>⠋ RUNNING ANALYSIS…</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>Examining LSB patterns across R / G / B channels</div>
            </div>
          )}

          {/* ── Verdict Card — shown after analysis ── */}
          {r && analysis.stegdetectStatus !== 'loading' && (
            <div
              className="mono"
              style={{
                border: `1px solid ${vc}`,
                borderRadius: '10px',
                overflow: 'hidden',
                animation: 'revealSlide 0.4s ease',
                boxShadow: `0 0 28px rgba(${vcRgb},0.12)`,
              }}
            >
              {/* Big banner */}
              <div style={{
                background: `rgba(${vcRgb},0.1)`,
                padding: '1.75rem 1rem',
                textAlign: 'center',
                borderBottom: `1px solid rgba(${vcRgb},0.25)`,
              }}>
                <div style={{ fontSize: '2.8rem', marginBottom: '0.5rem' }}>
                  {isEncoded ? '⚠️' : isInconclusive ? '❓' : '✅'}
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: vc, letterSpacing: '2px', marginBottom: '0.6rem' }}>
                  {isEncoded ? 'HIDDEN MESSAGE DETECTED' : isInconclusive ? 'INCONCLUSIVE RESULT' : 'NO HIDDEN MESSAGE FOUND'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '360px', margin: '0 auto' }}>
                  {isEncoded
                    ? 'The LSB distribution is statistically too uniform to be natural. This strongly indicates a hidden payload has been embedded in this image.'
                    : isInconclusive
                    ? 'Weak anomalies detected. A short or partially-encoded message may be present. Manual inspection is recommended.'
                    : 'The LSB bit pattern matches the natural distribution of an unmodified image. This image appears clean.'}
                </div>
              </div>

              {/* Confidence section */}
              <div style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>DETECTION CONFIDENCE:</span>
                  <span style={{ color: vc, fontWeight: 800, fontSize: '1.2rem' }}>{r.avg_confidence}%</span>
                </div>
                {/* Main confidence bar */}
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.07)', borderRadius: '4px', marginBottom: '1.25rem', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${r.avg_confidence}%`,
                    background: `linear-gradient(90deg, rgba(${vcRgb},0.5), ${vc})`,
                    borderRadius: '4px',
                    transition: 'width 0.7s ease',
                    boxShadow: `0 0 10px rgba(${vcRgb},0.5)`,
                  }} />
                </div>

                {/* Per-channel bars */}
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.6rem', letterSpacing: 1 }}>PER-CHANNEL LSB ANALYSIS:</div>
                {r.channels.map((ch: any) => {
                  const chColor = ch.channel === 'red' ? '#ff6b6b' : ch.channel === 'green' ? '#51cf66' : '#74c0fc';
                  return (
                    <div key={ch.channel} style={{ marginBottom: '0.7rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontSize: '0.72rem' }}>
                        <span style={{ color: chColor }}>● CH_{ch.channel.toUpperCase()}</span>
                        <span style={{ color: vc }}>{ch.confidence}% confidence</span>
                      </div>
                      <div style={{ height: '5px', background: 'rgba(255,255,255,0.07)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${ch.confidence}%`, background: vc, borderRadius: '3px', transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  );
                })}

                {/* Re-analyze + upload new */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  {detectFile && (
                    <button
                      onClick={() => runStegdetect(detectFile)}
                      className="mono"
                      style={{ flex: 1, background: 'transparent', border: `1px solid rgba(${vcRgb},0.4)`, color: vc, padding: '0.5rem', cursor: 'pointer', borderRadius: '4px', fontSize: '0.7rem' }}
                    >
                      ↺  RE-ANALYZE
                    </button>
                  )}
                  <button
                    onClick={() => { setDetectFile(null); setDetectPreview(null); dispatch({ type: 'ANALYSIS_SET_STEGDETECT_STATUS', payload: 'idle' }); }}
                    className="mono"
                    style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '0.5rem', cursor: 'pointer', borderRadius: '4px', fontSize: '0.7rem' }}
                  >
                    ✕  CLEAR
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
