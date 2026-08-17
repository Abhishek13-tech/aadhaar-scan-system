import React, { useRef, useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  Scan,
  Upload,
  Camera,
  CheckCircle2,
  AlertCircle,
  Download,
  Loader2,
  FileText,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const MAX_BYTES = 10 * 1024 * 1024;

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function UploadPage() {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const handleFile = useCallback((f) => {
    if (!f) return;
    if (!ACCEPTED_TYPES.includes(f.type)) {
      toast.error("Unsupported file", { description: "Please upload a JPEG, PNG, WEBP or PDF." });
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("File too large", { description: "Max size is 10 MB." });
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setResult(null);
    if (f.type !== "application/pdf") setPreviewUrl(URL.createObjectURL(f));
    else setPreviewUrl(null);
  }, [previewUrl]);

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const submit = async () => {
    if (!file) {
      toast.error("No file selected");
      return;
    }
    setIsProcessing(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post("/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
      if (data.success) toast.success("Extraction complete");
      else toast.error("Extraction incomplete", { description: data.message || "" });
    } catch (err) {
      const msg = apiErrorMessage(err);
      toast.error("Request failed", { description: msg });
      setResult({ success: false, message: msg, processed_at: new Date().toISOString() });
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const downloadJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aadhaar-ocr-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" data-testid="upload-page">
      <header>
        <div className="mono text-[10px] uppercase tracking-[0.3em] text-slate-500">Module 01 — Capture</div>
        <h1 className="mt-1 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 leading-none">
          Scan an Aadhaar card.
        </h1>
        <p className="mt-3 text-slate-600 text-sm md:text-base max-w-2xl">
          Upload a photo, PDF, or capture with your camera. We extract the name, date of birth,
          gender, and a masked Aadhaar number. Nothing is stored — the image never touches disk.
        </p>
      </header>

      <div className="grid md:grid-cols-2 border border-slate-200 bg-white">
        {/* LEFT */}
        <section className="p-4 md:p-6 border-b md:border-b-0 md:border-r border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="mono text-[10px] uppercase tracking-[0.3em] text-slate-500">Capture Surface</div>
            {file && (
              <button
                onClick={reset}
                data-testid="reset-button"
                className="mono text-[10px] uppercase tracking-[0.2em] text-slate-500 hover:text-[#FF9933] flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            )}
          </div>

          <div
            role="button"
            tabIndex={0}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => !file && fileInputRef.current?.click()}
            data-testid="upload-dropzone"
            className={[
              "reticle relative min-h-[320px] flex flex-col items-center justify-center text-center px-6 py-10 cursor-pointer select-none transition-colors border border-slate-300",
              isDragging ? "bg-[#FFF4E5]" : "bg-[#F8FAFC] hover:bg-slate-50",
            ].join(" ")}
          >
            <span className="reticle-tr" />
            <span className="reticle-bl" />
            {previewUrl ? (
              <div className="relative w-full max-w-md">
                <img src={previewUrl} alt="Aadhaar preview" data-testid="preview-image" className="w-full h-auto border border-slate-300 bg-white" />
                {isProcessing && <div className="scanner-beam" />}
              </div>
            ) : file?.type === "application/pdf" ? (
              <div className="flex flex-col items-center gap-3 text-slate-700">
                <FileText className="h-14 w-14 text-[#FF9933]" strokeWidth={1.5} />
                <div className="mono text-sm">{file.name}</div>
                <div className="mono text-xs text-slate-500">{formatFileSize(file.size)} · PDF selected</div>
              </div>
            ) : (
              <>
                <Scan className="h-12 w-12 text-[#FF9933] mb-4" strokeWidth={1.5} />
                <div className="text-base font-medium text-slate-900">Drag &amp; drop your Aadhaar document</div>
                <div className="mt-1 text-sm text-slate-500">JPEG · PNG · WEBP · PDF · up to 10 MB</div>
              </>
            )}
          </div>

          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" data-testid="upload-input-file" onChange={(e) => handleFile(e.target.files?.[0])} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" data-testid="camera-input-file" onChange={(e) => handleFile(e.target.files?.[0])} />

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button onClick={() => fileInputRef.current?.click()} data-testid="upload-file-button"
              className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium rounded-sm px-4 py-3 transition-colors flex items-center justify-center gap-2 text-sm">
              <Upload className="h-4 w-4" /> Upload File
            </button>
            <button onClick={() => cameraInputRef.current?.click()} data-testid="camera-capture-button"
              className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium rounded-sm px-4 py-3 transition-colors flex items-center justify-center gap-2 text-sm">
              <Camera className="h-4 w-4" /> Camera Capture
            </button>
          </div>

          <button onClick={submit} disabled={!file || isProcessing} data-testid="extract-button"
            className="mt-3 w-full bg-[#FF9933] text-white hover:bg-[#E88422] disabled:opacity-40 disabled:cursor-not-allowed font-medium tracking-wide rounded-sm px-6 py-3 transition-colors flex items-center justify-center gap-2 text-sm">
            {isProcessing ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Analysing document…</>
            ) : (
              <><Scan className="h-4 w-4" /> Extract Aadhaar Data</>
            )}
          </button>

          {file && (
            <div className="mt-3 mono text-[11px] uppercase tracking-[0.15em] text-slate-500 flex items-center justify-between">
              <span className="truncate pr-4">{file.name}</span>
              <span>{formatFileSize(file.size)}</span>
            </div>
          )}
        </section>

        {/* RIGHT */}
        <section className="p-4 md:p-6 bg-white" data-testid="results-panel">
          <div className="flex items-center justify-between mb-4">
            <div className="mono text-[10px] uppercase tracking-[0.3em] text-slate-500">Extraction Output</div>
            <div className="mono text-[10px] uppercase tracking-[0.2em]" data-testid="processing-status">
              {isProcessing ? <span className="text-[#FF9933]">Processing…</span> :
                result ? (result.success ? <span className="text-[#138808]">Complete</span> : <span className="text-red-600">Failed</span>) :
                <span className="text-slate-400">Idle</span>}
            </div>
          </div>

          {result && (
            <div data-testid="status-banner" className={[
              "flex items-start gap-2 px-3 py-2 mb-4 border text-sm",
              result.success ? "bg-emerald-50 border-emerald-200 text-[#138808]" : "bg-red-50 border-red-200 text-red-800",
            ].join(" ")}>
              {result.success ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
              <div className="leading-snug">{result.message}</div>
            </div>
          )}

          <div className="border border-slate-200">
            <DataCell label="Name" value={result?.name} testid="ocr-result-name" placeholder="—" mono={false} />
            <DataCell label="Date of Birth" value={result?.dob} testid="ocr-result-dob" placeholder="DD/MM/YYYY" />
            <DataCell label="Gender" value={result?.gender} testid="ocr-result-gender" placeholder="—" mono={false} />
            <DataCell label="Aadhaar Number" value={result?.aadhaar_masked} testid="ocr-result-aadhaar" placeholder="XXXX XXXX ••••" last />
          </div>
          {/* Face Detection */}
<div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">

  <div className="border border-slate-200 p-4">
    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
      Face Detection
    </div>

    <div className="mt-2 text-sm font-medium">
      {result?.face?.face_detected
        ? "✓ Face Detected"
        : "✗ Face Not Detected"}
    </div>

    {result?.face?.confidence != null && (
      <div className="mt-1 text-xs text-slate-500">
        Confidence: {result.face.confidence}%
      </div>
    )}
  </div>

  {/* QR Detection */}
  <div className="border border-slate-200 p-4">
    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
      QR Detection
    </div>

    <div className="mt-2 text-sm font-medium">
      {result?.qr?.qr_detected
        ? "✓ QR Code Detected"
        : "✗ QR Code Not Detected"}
    </div>

    {result?.qr?.data && (
      <div className="mt-1 text-xs text-slate-500 break-all">
        QR Data Detected
      </div>
    )}
  </div>

</div>

          <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
              {result?.confidence && (<>Confidence: <span className="text-slate-800">{result.confidence}</span></>)}
            </div>
            <button onClick={downloadJson} disabled={!result} data-testid="download-json-button"
              className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium rounded-sm px-4 py-2 transition-colors flex items-center justify-center gap-2 text-sm">
              <Download className="h-4 w-4" /> Download JSON
            </button>
          </div>

          {!result && !isProcessing && (
            <p className="mt-6 text-sm text-slate-500 leading-relaxed">
              Results appear here. We detect <span className="mono text-slate-700">Name</span>, <span className="mono text-slate-700">DOB</span>, <span className="mono text-slate-700">Gender</span> and a <span className="mono text-slate-700">masked Aadhaar number</span>. The full number is never displayed or retained.
            </p>
          )}
        </section>
      </div>

      <div className="text-xs text-slate-500 flex items-center gap-2 justify-center py-2">
        <ShieldCheck className="h-4 w-4 text-[#138808]" />
        End-to-end secure. Images are processed in memory and never stored. Not affiliated with UIDAI.
      </div>
    </div>
  );
}

function DataCell({ label, value, testid, placeholder, last = false, mono = true }) {
  return (
    <div className={["grid grid-cols-3 items-center", last ? "" : "border-b border-slate-200"].join(" ")}>
      <div className="col-span-1 px-3 py-3 border-r border-slate-200 bg-[#F8FAFC]">
        <div className="mono text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</div>
      </div>
      <div className="col-span-2 px-3 py-3">
        <div data-testid={testid} className={[mono ? "mono" : "", "text-sm sm:text-base", value ? "text-slate-900" : "text-slate-400"].join(" ")}>
          {value || placeholder}
        </div>
      </div>
    </div>
  );
}
