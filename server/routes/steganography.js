const express = require('express');
const router = express.Router();
const multer = require('multer');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

// ── Multer: store uploads in OS temp dir ────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `stegano-${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(Object.assign(new Error('Only image files are allowed'), { status: 400 }));
    }
    cb(null, true);
  },
});

const PYTHON = process.env.PYTHON_BIN || 'python3';
const SCRIPTS_DIR = path.join(__dirname, '..');

// ── Helper: run a Python script and return stdout ───────────────────────────
function runPython(scriptPath, args) {
  return new Promise((resolve, reject) => {
    execFile(PYTHON, [scriptPath, ...args], { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) {
        const msg = stderr.trim() || err.message;
        return reject(Object.assign(new Error(msg), { status: 422 }));
      }
      resolve(stdout);
    });
  });
}

// ── POST /api/encode ─────────────────────────────────────────────────────────
router.post('/encode', upload.single('image'), async (req, res, next) => {
  const inputPath = req.file?.path;
  const message = (req.body.message || '').trim();

  if (!inputPath) {
    return res.status(400).json({ error: 'No image file uploaded.' });
  }
  if (!message) {
    fs.unlink(inputPath, () => { });
    return res.status(400).json({ error: 'Message cannot be empty.' });
  }

  const outputPath = path.join(os.tmpdir(), `encoded-${uuidv4()}.png`);

  try {
    const scriptPath = path.join(__dirname, '..', 'encode_server.py');
    await runPython(scriptPath, [inputPath, message, outputPath]);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'attachment; filename="encoded.png"');

    const stream = fs.createReadStream(outputPath);
    stream.pipe(res);
    stream.on('end', () => {
      fs.unlink(inputPath, () => { });
      fs.unlink(outputPath, () => { });
    });
    stream.on('error', next);
  } catch (err) {
    fs.unlink(inputPath, () => { });
    fs.unlink(outputPath, () => { });
    next(err);
  }
});

// ── POST /api/decode ─────────────────────────────────────────────────────────
router.post('/decode', upload.single('image'), async (req, res, next) => {
  const inputPath = req.file?.path;

  if (!inputPath) {
    return res.status(400).json({ error: 'No image file uploaded.' });
  }

  try {
    const scriptPath = path.join(__dirname, '..', 'decode_server.py');
    const message = await runPython(scriptPath, [inputPath]);

    fs.unlink(inputPath, () => { });
    res.json({ message: message.trim() });
  } catch (err) {
    fs.unlink(inputPath, () => { });
    next(err);
  }
});

// ── POST /api/stegdetect ─────────────────────────────────────────────────────
// Chi-square statistical steganalysis — detect if image LIKELY contains data
router.post('/stegdetect', upload.single('image'), async (req, res, next) => {
  const inputPath = req.file?.path;
  if (!inputPath) return res.status(400).json({ error: 'No image uploaded.' });

  try {
    const scriptPath = path.join(__dirname, '..', 'stegdetect_server.py');
    const output = await runPython(scriptPath, [inputPath]);
    const result = JSON.parse(output);
    fs.unlink(inputPath, () => {});
    res.json(result);
  } catch (err) {
    if (inputPath) fs.unlink(inputPath, () => {});
    next(err);
  }
});

// ── POST /api/hash ────────────────────────────────────────────────────────────
// SHA-256 hash + metadata for a single image file
router.post('/hash', upload.single('image'), async (req, res, next) => {
  const inputPath = req.file?.path;
  if (!inputPath) return res.status(400).json({ error: 'No image uploaded.' });

  try {
    const scriptPath = path.join(__dirname, '..', 'hash_server.py');
    const output = await runPython(scriptPath, [inputPath]);
    const result = JSON.parse(output);
    fs.unlink(inputPath, () => {});
    res.json(result);
  } catch (err) {
    if (inputPath) fs.unlink(inputPath, () => {});
    next(err);
  }
});

// ── POST /api/analyze ────────────────────────────────────────────────────────
// Standard differential scan — compare images and find changed pixels
router.post('/analyze', upload.fields([{ name: 'original' }, { name: 'encoded' }]), async (req, res, next) => {
  const origPath = req.files['original']?.[0]?.path;
  const encPath = req.files['encoded']?.[0]?.path;

  if (!origPath || !encPath) {
    if (origPath) fs.unlink(origPath, () => {});
    if (encPath) fs.unlink(encPath, () => {});
    return res.status(400).json({ error: 'Both original and encoded images are required.' });
  }

  const outPath = path.join(os.tmpdir(), `forensic-heatmap-${uuidv4()}.png`);

  try {
    const scriptPath = path.join(__dirname, '..', 'analysis_v1.py');
    const output = await runPython(scriptPath, [origPath, encPath, outPath]);
    const result = JSON.parse(output);

    // Read heatmap image as base64
    const heatmapBuffer = fs.readFileSync(outPath);
    result.heatmap = `data:image/png;base64,${heatmapBuffer.toString('base64')}`;

    // Cleanup
    fs.unlink(origPath, () => {});
    fs.unlink(encPath, () => {});
    fs.unlink(outPath, () => {});

    res.json(result);
  } catch (err) {
    if (origPath) fs.unlink(origPath, () => {});
    if (encPath) fs.unlink(encPath, () => {});
    if (fs.existsSync(outPath)) fs.unlink(outPath, () => {});
    next(err);
  }
});

// ── POST /api/analyze-v2 ──────────────────────────────────────────────────────
// Advanced region detection — compare images and find bounding box
router.post('/analyze-v2', upload.fields([{ name: 'original' }, { name: 'encoded' }]), async (req, res, next) => {
  const origPath = req.files['original']?.[0]?.path;
  const encPath = req.files['encoded']?.[0]?.path;

  if (!origPath || !encPath) {
    if (origPath) fs.unlink(origPath, () => {});
    if (encPath) fs.unlink(encPath, () => {});
    return res.status(400).json({ error: 'Both original and encoded images are required.' });
  }

  const outPath = path.join(os.tmpdir(), `forensic-box-${uuidv4()}.png`);

  try {
    const scriptPath = path.join(__dirname, '..', 'forensic_engine.py');
    const output = await runPython(scriptPath, [origPath, encPath, outPath]);
    const result = JSON.parse(output);

    if (result.error) throw new Error(result.error);

    // Read heatmap image as base64
    const heatmapBuffer = fs.readFileSync(outPath);
    result.annotated_image = `data:image/png;base64,${heatmapBuffer.toString('base64')}`;

    // Cleanup
    fs.unlink(origPath, () => {});
    fs.unlink(encPath, () => {});
    fs.unlink(outPath, () => {});

    res.json(result);
  } catch (err) {
    if (origPath) fs.unlink(origPath, () => {});
    if (encPath) fs.unlink(encPath, () => {});
    if (fs.existsSync(outPath)) fs.unlink(outPath, () => {});
    next(err);
  }
});

module.exports = router;
