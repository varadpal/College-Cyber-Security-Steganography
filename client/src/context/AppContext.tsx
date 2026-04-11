import { createContext, useContext, useReducer, ReactNode } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────
export type Status = 'idle' | 'loading' | 'success' | 'error';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
  module: string;
  message: string;
}

export interface HashInfo {
  sha256: string;
  size_bytes: number;
  format: string;
  dimensions: string;
  mode: string;
  capacity_chars: number;
}

export interface AnalysisMetrics {
  mse: number;
  psnr: number;
  changed_pixels: number;
  percent_changed: number;
  dimensions: string;
}

export interface StegdetectResult {
  verdict: 'LIKELY_ENCODED' | 'INCONCLUSIVE' | 'LIKELY_CLEAN';
  assessment: string;
  avg_confidence: number;
  channels: Array<{ channel: string; chi_sq: number; confidence: number }>;
}

export interface SenderState {
  message: string;
  password: string;
  scrubMetadata: boolean;
  coverImage: File | null;
  coverImagePreview: string | null;
  encodedImageUrl: string | null;
  coverHash: HashInfo | null;
  status: Status;
  errorMessage: string | null;
}

export interface ReceiverState {
  encodedImage: File | null;
  encodedImagePreview: string | null;
  password: string;
  decodedMessage: string | null;
  status: Status;
  errorMessage: string | null;
}

export interface AnalysisState {
  originalImage: File | null;
  originalPreview: string | null;
  encodedImage: File | null;
  encodedPreview: string | null;
  heatmapUrl: string | null;
  metrics: AnalysisMetrics | null;
  stegdetectResult: StegdetectResult | null;
  stegdetectStatus: Status;
  deepScanResult: any | null; // { bbox, metrics, annotated_image, logic_steps }
  deepScanStatus: Status;
  status: Status;
  errorMessage: string | null;
}

interface AppState {
  sender: SenderState;
  receiver: ReceiverState;
  analysis: AnalysisState;
  activityLog: LogEntry[];
}

type Action =
  // Sender
  | { type: 'SENDER_SET_MESSAGE'; payload: string }
  | { type: 'SENDER_SET_PASSWORD'; payload: string }
  | { type: 'SENDER_TOGGLE_METADATA'; payload: boolean }
  | { type: 'SENDER_SET_IMAGE'; payload: { file: File; preview: string } }
  | { type: 'SENDER_SET_HASH'; payload: HashInfo }
  | { type: 'SENDER_SET_STATUS'; payload: { status: Status; errorMessage?: string } }
  | { type: 'SENDER_SET_ENCODED'; payload: string }
  | { type: 'SENDER_RESET' }
  // Receiver
  | { type: 'RECEIVER_SET_IMAGE'; payload: { file: File; preview: string } }
  | { type: 'RECEIVER_SET_PASSWORD'; payload: string }
  | { type: 'RECEIVER_SET_STATUS'; payload: { status: Status; errorMessage?: string } }
  | { type: 'RECEIVER_SET_DECODED'; payload: string }
  | { type: 'RECEIVER_RESET' }
  // Analysis
  | { type: 'ANALYSIS_SET_ORIGINAL'; payload: { file: File; preview: string } }
  | { type: 'ANALYSIS_SET_ENCODED'; payload: { file: File; preview: string } }
  | { type: 'ANALYSIS_SET_RESULT'; payload: { metrics: AnalysisMetrics; heatmap: string } }
  | { type: 'ANALYSIS_SET_STATUS'; payload: { status: Status; errorMessage?: string } }
  | { type: 'ANALYSIS_SET_STEGDETECT'; payload: StegdetectResult }
  | { type: 'ANALYSIS_SET_STEGDETECT_STATUS'; payload: Status }
  | { type: 'ANALYSIS_SET_DEEP_SCAN'; payload: any }
  | { type: 'ANALYSIS_SET_DEEP_SCAN_STATUS'; payload: Status }
  | { type: 'ANALYSIS_RESET' }
  // Activity Log
  | { type: 'LOG_ADD'; payload: Omit<LogEntry, 'id' | 'timestamp'> }
  | { type: 'LOG_CLEAR' };

// ── Initial state ─────────────────────────────────────────────────────────────
const initialSender: SenderState = {
  message: '',
  password: '',
  scrubMetadata: false,
  coverImage: null,
  coverImagePreview: null,
  encodedImageUrl: null,
  coverHash: null,
  status: 'idle',
  errorMessage: null,
};

const initialReceiver: ReceiverState = {
  encodedImage: null,
  encodedImagePreview: null,
  password: '',
  decodedMessage: null,
  status: 'idle',
  errorMessage: null,
};

const initialAnalysis: AnalysisState = {
  originalImage: null,
  originalPreview: null,
  encodedImage: null,
  encodedPreview: null,
  heatmapUrl: null,
  metrics: null,
  stegdetectResult: null,
  stegdetectStatus: 'idle',
  deepScanResult: null,
  deepScanStatus: 'idle',
  status: 'idle',
  errorMessage: null,
};

const initialState: AppState = {
  sender: initialSender,
  receiver: initialReceiver,
  analysis: initialAnalysis,
  activityLog: [
    {
      id: 'boot',
      timestamp: new Date().toLocaleTimeString(),
      level: 'INFO',
      module: 'SYSTEM',
      message: 'SteganoVault v2 initialized. All subsystems operational.',
    },
  ],
};

// ── Reducer ───────────────────────────────────────────────────────────────────
function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    // Sender
    case 'SENDER_SET_MESSAGE':
      return { ...state, sender: { ...state.sender, message: action.payload } };
    case 'SENDER_SET_PASSWORD':
      return { ...state, sender: { ...state.sender, password: action.payload } };
    case 'SENDER_TOGGLE_METADATA':
      return { ...state, sender: { ...state.sender, scrubMetadata: action.payload } };
    case 'SENDER_SET_IMAGE':
      return {
        ...state,
        sender: {
          ...state.sender,
          coverImage: action.payload.file,
          coverImagePreview: action.payload.preview,
          encodedImageUrl: null,
          coverHash: null,
          status: 'idle',
          errorMessage: null,
        },
      };
    case 'SENDER_SET_HASH':
      return { ...state, sender: { ...state.sender, coverHash: action.payload } };
    case 'SENDER_SET_STATUS':
      return {
        ...state,
        sender: { ...state.sender, status: action.payload.status, errorMessage: action.payload.errorMessage ?? null },
      };
    case 'SENDER_SET_ENCODED':
      return { ...state, sender: { ...state.sender, encodedImageUrl: action.payload, status: 'success' } };
    case 'SENDER_RESET':
      return { ...state, sender: initialSender };

    // Receiver
    case 'RECEIVER_SET_IMAGE':
      return {
        ...state,
        receiver: {
          ...state.receiver,
          encodedImage: action.payload.file,
          encodedImagePreview: action.payload.preview,
          decodedMessage: null,
          status: 'idle',
          errorMessage: null,
        },
      };
    case 'RECEIVER_SET_PASSWORD':
      return { ...state, receiver: { ...state.receiver, password: action.payload } };
    case 'RECEIVER_SET_STATUS':
      return {
        ...state,
        receiver: { ...state.receiver, status: action.payload.status, errorMessage: action.payload.errorMessage ?? null },
      };
    case 'RECEIVER_SET_DECODED':
      return { ...state, receiver: { ...state.receiver, decodedMessage: action.payload, status: 'success' } };
    case 'RECEIVER_RESET':
      return { ...state, receiver: initialReceiver };

    // Analysis
    case 'ANALYSIS_SET_ORIGINAL':
      return { ...state, analysis: { ...state.analysis, originalImage: action.payload.file, originalPreview: action.payload.preview, heatmapUrl: null } };
    case 'ANALYSIS_SET_ENCODED':
      return { ...state, analysis: { ...state.analysis, encodedImage: action.payload.file, encodedPreview: action.payload.preview, heatmapUrl: null } };
    case 'ANALYSIS_SET_RESULT':
      return { ...state, analysis: { ...state.analysis, metrics: action.payload.metrics, heatmapUrl: action.payload.heatmap, status: 'success' } };
    case 'ANALYSIS_SET_STATUS':
      return { ...state, analysis: { ...state.analysis, status: action.payload.status, errorMessage: action.payload.errorMessage ?? null } };
    case 'ANALYSIS_SET_STEGDETECT':
      return { ...state, analysis: { ...state.analysis, stegdetectResult: action.payload, stegdetectStatus: 'success' } };
    case 'ANALYSIS_SET_STEGDETECT_STATUS':
      return { ...state, analysis: { ...state.analysis, stegdetectStatus: action.payload } };
    case 'ANALYSIS_SET_DEEP_SCAN':
      return { ...state, analysis: { ...state.analysis, deepScanResult: action.payload, deepScanStatus: 'success' } };
    case 'ANALYSIS_SET_DEEP_SCAN_STATUS':
      return { ...state, analysis: { ...state.analysis, deepScanStatus: action.payload } };
    case 'ANALYSIS_RESET':
      return { ...state, analysis: initialAnalysis };

    // Activity Log
    case 'LOG_ADD':
      return {
        ...state,
        activityLog: [
          {
            id: `${Date.now()}-${Math.random()}`,
            timestamp: new Date().toLocaleTimeString(),
            ...action.payload,
          },
          ...state.activityLog,
        ].slice(0, 100), // keep last 100 entries
      };
    case 'LOG_CLEAR':
      return { ...state, activityLog: [] };

    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────
interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider');
  return ctx;
}
