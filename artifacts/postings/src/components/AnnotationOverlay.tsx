import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useCreateAnnotation, getListAnnotationsQueryKey } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Post } from '@workspace/api-client-react';
import { Undo2, X, Check, PenTool, Type, MousePointer, Image as ImageIcon } from 'lucide-react';
import { getSession } from '@/session';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

type AnnotationMode = 'draw' | 'text' | 'select';

interface AnnotationOverlayProps {
  post: Post;
  onClose: () => void;
}

// Work area as fraction of canvas (centered)
const WORK_AREA = { x: 0.06, y: 0.10, w: 0.88, h: 0.80 };

interface PlacedStroke {
  points: Array<{ x: number; y: number }>;
  offsetX: number;
  offsetY: number;
}

interface PlacedText {
  x: number;
  y: number;
  text: string;
}

export function AnnotationOverlay({ post, onClose }: AnnotationOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const session = getSession();

  const [mode, setMode] = useState<AnnotationMode>('draw');
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Strokes and texts with mutable refs (avoids stale closures in canvas handlers)
  const strokes = useRef<PlacedStroke[]>([]);
  const texts = useRef<PlacedText[]>([]);
  const [strokesVer, setStrokesVer] = useState(0);
  const [textsVer, setTextsVer] = useState(0);
  const isDrawing = useRef(false);
  const currentStroke = useRef<Array<{ x: number; y: number }>>([]);

  // Text input
  const [textPos, setTextPos] = useState<{ px: number; py: number; nx: number; ny: number } | null>(null);
  const [textValue, setTextValue] = useState('');
  const textInputRef = useRef<HTMLInputElement>(null);

  // Select/move mode state
  const [selectedStrokeIdx, setSelectedStrokeIdx] = useState<number | null>(null);
  const [selectedTextIdx, setSelectedTextIdx] = useState<number | null>(null);
  const selectDragRef = useRef({
    active: false,
    startX: 0, startY: 0,
    origX: 0, origY: 0,
    type: null as 'stroke' | 'text' | null,
    idx: -1,
  });
  const [editingTextIdx, setEditingTextIdx] = useState<number | null>(null);
  const [editTextValue, setEditTextValue] = useState('');
  const editTextInputRef = useRef<HTMLInputElement>(null);
  const editTextPos = editingTextIdx !== null && texts.current[editingTextIdx]
    ? texts.current[editingTextIdx]
    : null;

  const createAnnotation = useCreateAnnotation();
  const bgImageRef = useRef<string | null>(null);
  useEffect(() => { bgImageRef.current = bgImage; }, [bgImage]);

  // ── Work area helpers ──────────────────────────────────────────────────────
  const getWorkAreaPixels = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.width / dpr;
    const ch = canvas.height / dpr;
    return {
      x: WORK_AREA.x * cw,
      y: WORK_AREA.y * ch,
      w: WORK_AREA.w * cw,
      h: WORK_AREA.h * ch,
    };
  }, []);

  // ── Canvas draw ────────────────────────────────────────────────────────────
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.width / dpr;
    const ch = canvas.height / dpr;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    const wa = { x: WORK_AREA.x * cw, y: WORK_AREA.y * ch, w: WORK_AREA.w * cw, h: WORK_AREA.h * ch };

    // ── Background image in work area ──
    if (bgImageRef.current) {
      const img = new Image();
      img.src = bgImageRef.current;
      if (img.complete) {
        ctx.drawImage(img, wa.x, wa.y, wa.w, wa.h);
      }
    }

    // ── Work area visual indicator ──
    ctx.save();
    // Subtle inner glow / border
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.roundRect(wa.x, wa.y, wa.w, wa.h, 4);
    ctx.stroke();
    ctx.setLineDash([]);

    // Soft vignette outside work area
    const gradient = ctx.createRadialGradient(
      cw / 2, ch / 2, Math.min(wa.w, wa.h) * 0.45,
      cw / 2, ch / 2, Math.max(cw, ch) * 0.7
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, cw, ch);
    ctx.restore();

    // ── Work area label ──
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.font = '9px "DM Sans", sans-serif';
    ctx.fillText('WORK AREA', wa.x + 6, wa.y + 12);

    // ── Strokes ──
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(255,255,255,0.7)';

    const drawStroke = (pts: Array<{ x: number; y: number }>, ox = 0, oy = 0) => {
      if (pts.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x * cw + ox, pts[0].y * ch + oy);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * cw + ox, pts[i].y * ch + oy);
      ctx.stroke();
    };

    strokes.current.forEach((s, i) => {
      if (selectedStrokeIdx === i) {
        ctx.save();
        ctx.strokeStyle = '#3b82f6';
        ctx.shadowColor = '#3b82f660';
        drawStroke(s.points, s.offsetX * cw, s.offsetY * ch);
        ctx.restore();
        ctx.strokeStyle = '#ffffff';
        ctx.shadowColor = 'rgba(255,255,255,0.7)';
      } else {
        drawStroke(s.points, s.offsetX * cw, s.offsetY * ch);
      }
    });

    if (isDrawing.current && currentStroke.current.length > 1) {
      drawStroke(currentStroke.current);
    }

    ctx.shadowBlur = 0;

    // ── Text elements ──
    ctx.font = 'bold 18px "DM Sans", sans-serif';
    texts.current.forEach((t, i) => {
      if (i === editingTextIdx) return; // editing in input
      const isSelectedTxt = selectedTextIdx === i;
      ctx.fillStyle = isSelectedTxt ? '#3b82f6' : '#E55A1B';
      if (isSelectedTxt) {
        ctx.save();
        ctx.shadowColor = '#3b82f640';
        ctx.shadowBlur = 8;
      }
      ctx.fillText(t.text, t.x * cw, t.y * ch);
      if (isSelectedTxt) ctx.restore();
    });

    ctx.restore();
  }, [selectedStrokeIdx, selectedTextIdx, editingTextIdx]);

  // Load bg image to force redraw when it changes
  useEffect(() => {
    if (!bgImage) { redraw(); return; }
    const img = new Image();
    img.onload = () => redraw();
    img.src = bgImage;
  }, [bgImage, redraw]);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    redraw();
  }, [redraw]);

  useEffect(() => {
    initCanvas();
    window.addEventListener('resize', initCanvas);
    return () => window.removeEventListener('resize', initCanvas);
  }, [initCanvas]);

  useEffect(() => { redraw(); }, [strokesVer, textsVer, redraw]);

  useEffect(() => {
    if (textPos) setTimeout(() => textInputRef.current?.focus(), 20);
  }, [textPos]);

  useEffect(() => {
    if (editingTextIdx !== null) setTimeout(() => editTextInputRef.current?.focus(), 20);
  }, [editingTextIdx]);

  // ── Hit testing for select mode ────────────────────────────────────────────
  const hitTestStroke = useCallback((nx: number, ny: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return -1;
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.width / dpr;
    const ch = canvas.height / dpr;
    const HIT_DIST = 0.02; // normalized distance
    for (let i = strokes.current.length - 1; i >= 0; i--) {
      const s = strokes.current[i];
      for (let j = 0; j < s.points.length - 1; j++) {
        const ax = s.points[j].x + s.offsetX, ay = s.points[j].y + s.offsetY;
        const bx = s.points[j + 1].x + s.offsetX, by = s.points[j + 1].y + s.offsetY;
        const dx = bx - ax, dy = by - ay;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) continue;
        let t = ((nx - ax) * dx + (ny - ay) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const dist = Math.sqrt((nx - ax - t * dx) ** 2 + (ny - ay - t * dy) ** 2);
        if (dist < HIT_DIST) return i;
      }
    }
    return -1;
  }, []);

  const hitTestText = useCallback((nx: number, ny: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return -1;
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.width / dpr;
    const ch = canvas.height / dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return -1;
    ctx.font = 'bold 18px "DM Sans", sans-serif';
    for (let i = texts.current.length - 1; i >= 0; i--) {
      const t = texts.current[i];
      const tw = ctx.measureText(t.text).width / cw;
      const th = 24 / ch;
      if (nx >= t.x - 0.01 && nx <= t.x + tw + 0.01 && ny >= t.y - th && ny <= t.y + 0.02) return i;
    }
    return -1;
  }, []);

  // ── Pointer helpers ────────────────────────────────────────────────────────
  const getPos = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return { px: 0, py: 0, nx: 0, ny: 0 };
    const rect = container.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    return { px, py, nx: px / rect.width, ny: py / rect.height };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (textPos) return;
    if (editingTextIdx !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = getPos(e.clientX, e.clientY);

    if (mode === 'draw') {
      isDrawing.current = true;
      currentStroke.current = [{ x: pos.nx, y: pos.ny }];
    } else if (mode === 'text') {
      setTextPos(pos);
      setTextValue('');
    } else if (mode === 'select') {
      // Hit test text first, then strokes
      const ti = hitTestText(pos.nx, pos.ny);
      if (ti >= 0) {
        // Double tap check for re-edit
        setSelectedTextIdx(ti);
        setSelectedStrokeIdx(null);
        selectDragRef.current = {
          active: true,
          startX: pos.nx, startY: pos.ny,
          origX: texts.current[ti].x,
          origY: texts.current[ti].y,
          type: 'text', idx: ti,
        };
        return;
      }
      const si = hitTestStroke(pos.nx, pos.ny);
      if (si >= 0) {
        setSelectedStrokeIdx(si);
        setSelectedTextIdx(null);
        selectDragRef.current = {
          active: true,
          startX: pos.nx, startY: pos.ny,
          origX: strokes.current[si].offsetX,
          origY: strokes.current[si].offsetY,
          type: 'stroke', idx: si,
        };
        return;
      }
      // Deselect
      setSelectedStrokeIdx(null);
      setSelectedTextIdx(null);
    }
  }, [mode, textPos, editingTextIdx, getPos, hitTestText, hitTestStroke]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const pos = getPos(e.clientX, e.clientY);

    if (mode === 'draw' && isDrawing.current) {
      currentStroke.current = [...currentStroke.current, { x: pos.nx, y: pos.ny }];
      redraw();
    } else if (mode === 'select' && selectDragRef.current.active) {
      const dx = pos.nx - selectDragRef.current.startX;
      const dy = pos.ny - selectDragRef.current.startY;
      const { type, idx } = selectDragRef.current;
      if (type === 'stroke') {
        strokes.current[idx].offsetX = selectDragRef.current.origX + dx;
        strokes.current[idx].offsetY = selectDragRef.current.origY + dy;
        setStrokesVer(v => v + 1);
      } else if (type === 'text') {
        texts.current[idx].x = selectDragRef.current.origX + dx;
        texts.current[idx].y = selectDragRef.current.origY + dy;
        setTextsVer(v => v + 1);
      }
    }
  }, [mode, getPos, redraw]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (mode === 'draw' && isDrawing.current && currentStroke.current.length > 1) {
      strokes.current = [...strokes.current, { points: currentStroke.current, offsetX: 0, offsetY: 0 }];
      setStrokesVer(v => v + 1);
    }
    currentStroke.current = [];
    isDrawing.current = false;
    selectDragRef.current.active = false;
  }, [mode]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (mode !== 'select') return;
    const pos = getPos(e.clientX, e.clientY);
    const ti = hitTestText(pos.nx, pos.ny);
    if (ti >= 0) {
      setEditingTextIdx(ti);
      setEditTextValue(texts.current[ti].text);
    }
  }, [mode, getPos, hitTestText]);

  const commitText = useCallback(() => {
    if (textValue.trim() && textPos) {
      texts.current = [...texts.current, { x: textPos.nx, y: textPos.ny, text: textValue.trim() }];
      setTextsVer(v => v + 1);
    }
    setTextPos(null);
    setTextValue('');
  }, [textValue, textPos]);

  const cancelText = useCallback(() => { setTextPos(null); setTextValue(''); }, []);

  const commitEditText = useCallback(() => {
    if (editingTextIdx !== null) {
      if (editTextValue.trim()) {
        texts.current[editingTextIdx].text = editTextValue.trim();
      } else {
        texts.current.splice(editingTextIdx, 1);
      }
      setTextsVer(v => v + 1);
    }
    setEditingTextIdx(null);
    setEditTextValue('');
  }, [editingTextIdx, editTextValue]);

  const undo = useCallback(() => {
    if (mode === 'draw' || mode === 'select') {
      if (strokes.current.length > 0) { strokes.current = strokes.current.slice(0, -1); setStrokesVer(v => v + 1); }
    } else if (mode === 'text') {
      if (texts.current.length > 0) { texts.current = texts.current.slice(0, -1); setTextsVer(v => v + 1); }
    }
  }, [mode]);

  const clear = useCallback(() => {
    strokes.current = []; texts.current = [];
    setBgImage(null);
    setStrokesVer(v => v + 1); setTextsVer(v => v + 1);
  }, []);

  // ── Image handling ─────────────────────────────────────────────────────────
  const loadImage = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      const img = new Image();
      img.onload = () => { setBgImage(data); };
      img.src = data;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadImage(file);
  }, [loadImage]);

  // ── Capture work area as data URL ─────────────────────────────────────────
  const captureWorkArea = useCallback((): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.width / dpr;
    const ch = canvas.height / dpr;
    const wa = {
      x: Math.round(WORK_AREA.x * cw * dpr),
      y: Math.round(WORK_AREA.y * ch * dpr),
      w: Math.round(WORK_AREA.w * cw * dpr),
      h: Math.round(WORK_AREA.h * ch * dpr),
    };
    const offscreen = document.createElement('canvas');
    offscreen.width = wa.w;
    offscreen.height = wa.h;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(canvas, wa.x, wa.y, wa.w, wa.h, 0, 0, wa.w, wa.h);
    return offscreen.toDataURL('image/png', 0.7);
  }, []);

  const handleApply = async () => {
    if (!strokes.current.length && !texts.current.length && !bgImage) { onClose(); return; }
    if (!session) return;
    const imageData = captureWorkArea();
    try {
      await createAnnotation.mutateAsync({
        postId: post.id,
        data: {
          type: strokes.current.length > 0 ? 'drawing' : 'text',
          strokes: strokes.current.map(s => ({
            points: s.points.map(p => ({ x: p.x + s.offsetX, y: p.y + s.offsetY }))
          })),
          texts: texts.current,
          text: texts.current.map(t => t.text).join(' '),
          imageData,
          authorId: session.userId,
          authorName: session.userName,
        } as any
      });
      queryClient.invalidateQueries({ queryKey: getListAnnotationsQueryKey(post.id) });
      toast({ title: 'Annotation saved' });
      onClose();
    } catch (e: any) {
      toast({ title: 'Failed to save', description: e.message, variant: 'destructive' });
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingTextIdx !== null) setEditingTextIdx(null);
        else if (textPos) cancelText();
        else onClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if (!textPos && !editingTextIdx) {
        if (e.key === 'd') setMode('draw');
        if (e.key === 't') setMode('text');
        if (e.key === 's') setMode('select');
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && mode === 'select') {
        if (selectedStrokeIdx !== null) {
          strokes.current.splice(selectedStrokeIdx, 1);
          setStrokesVer(v => v + 1);
          setSelectedStrokeIdx(null);
        }
        if (selectedTextIdx !== null) {
          texts.current.splice(selectedTextIdx, 1);
          setTextsVer(v => v + 1);
          setSelectedTextIdx(null);
        }
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [textPos, editingTextIdx, onClose, undo, cancelText, mode, selectedStrokeIdx, selectedTextIdx]);

  // Canvas cursor
  const canvasCursor = mode === 'text' ? 'text' : mode === 'select' ? 'default' : 'crosshair';

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col"
      onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" />

      {/* Drag-over overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-40 border-2 border-primary/60 bg-primary/5 flex items-center justify-center pointer-events-none">
          <p className="text-primary font-semibold text-lg">Drop image here</p>
        </div>
      )}

      {/* Desktop toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 max-md:hidden">
        <AnnotationToolbar
          mode={mode}
          onMode={setMode}
          onUndo={undo}
          onClear={clear}
          onDiscard={onClose}
          onApply={handleApply}
          onImage={() => fileInputRef.current?.click()}
          isPending={createAnnotation.isPending}
        />
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ cursor: canvasCursor, touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      />

      {/* New text input */}
      {textPos && (
        <input
          ref={textInputRef}
          value={textValue}
          onChange={e => setTextValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commitText(); }
            if (e.key === 'Escape') { e.preventDefault(); cancelText(); }
          }}
          onBlur={commitText}
          placeholder="Type text…"
          className="absolute z-30 bg-black/50 backdrop-blur-sm border border-primary/60 text-primary font-bold px-3 py-1.5 text-base rounded outline-none min-w-[120px] max-w-[280px]"
          style={{
            left: `${textPos.px}px`,
            top: `${textPos.py}px`,
            transform: 'translate(-4px, -50%)',
          }}
        />
      )}

      {/* Edit text input (select mode double-click) */}
      {editingTextIdx !== null && editTextPos && (() => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const dpr = window.devicePixelRatio || 1;
        const cw = canvas.width / dpr;
        const ch = canvas.height / dpr;
        return (
          <input
            ref={editTextInputRef}
            value={editTextValue}
            onChange={e => setEditTextValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commitEditText(); }
              if (e.key === 'Escape') { setEditingTextIdx(null); }
            }}
            onBlur={commitEditText}
            className="absolute z-30 bg-black/50 backdrop-blur-sm border border-primary/60 text-primary font-bold px-3 py-1.5 text-base rounded outline-none min-w-[120px] max-w-[280px]"
            style={{
              left: `${editTextPos.x * cw}px`,
              top: `${editTextPos.y * ch}px`,
              transform: 'translate(-4px, -50%)',
            }}
          />
        );
      })()}

      {/* Hidden file input for images */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) loadImage(f); e.target.value = ''; }}
      />

      {/* Mobile toolbar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 md:hidden safe-area-bottom">
        <AnnotationToolbar
          mode={mode}
          onMode={setMode}
          onUndo={undo}
          onClear={clear}
          onDiscard={onClose}
          onApply={handleApply}
          onImage={() => fileInputRef.current?.click()}
          isPending={createAnnotation.isPending}
          mobile
        />
      </div>
    </div>
  );
}

// ── Toolbar ────────────────────────────────────────────────────────────────────

function AnnotationToolbar({
  mode, onMode, onUndo, onClear, onDiscard, onApply, onImage, isPending, mobile = false,
}: {
  mode: AnnotationMode;
  onMode: (m: AnnotationMode) => void;
  onUndo: () => void;
  onClear: () => void;
  onDiscard: () => void;
  onApply: () => void;
  onImage: () => void;
  isPending: boolean;
  mobile?: boolean;
}) {
  if (mobile) {
    return (
      <div className="bg-black/80 backdrop-blur border-t border-white/10 px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex gap-1">
          <ToolBtn active={mode === 'draw'} onClick={() => onMode('draw')} label="Draw" icon={<PenTool className="w-4 h-4" />} size="lg" />
          <ToolBtn active={mode === 'text'} onClick={() => onMode('text')} label="Text" icon={<Type className="w-4 h-4" />} size="lg" />
          <ToolBtn active={mode === 'select'} onClick={() => onMode('select')} label="Select" icon={<MousePointer className="w-4 h-4" />} size="lg" />
          <ToolBtn onClick={onImage} label="Image" icon={<ImageIcon className="w-4 h-4" />} size="lg" />
        </div>
        <div className="flex gap-1">
          <ToolBtn onClick={onUndo} icon={<Undo2 className="w-4 h-4" />} label="Undo" size="lg" />
          <ToolBtn onClick={onClear} icon={<X className="w-4 h-4" />} label="Clear" size="lg" />
        </div>
        <div className="flex gap-1">
          <button onClick={onDiscard} className="px-3 py-2 text-xs text-white/60 hover:text-white rounded min-h-[44px]">Discard</button>
          <button
            onClick={onApply}
            disabled={isPending}
            className="px-4 py-2 text-xs bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5 min-h-[44px]"
          >
            <Check className="w-3.5 h-3.5" /> Apply
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 bg-black/70 border border-white/10 backdrop-blur rounded-full px-2 py-1 shadow-xl">
      <ToolBtn active={mode === 'draw'} onClick={() => onMode('draw')} icon={<PenTool className="w-3.5 h-3.5" />} label="Draw (D)" />
      <ToolBtn active={mode === 'text'} onClick={() => onMode('text')} icon={<Type className="w-3.5 h-3.5" />} label="Text (T)" />
      <ToolBtn active={mode === 'select'} onClick={() => onMode('select')} icon={<MousePointer className="w-3.5 h-3.5" />} label="Select (S)" />
      <ToolBtn onClick={onImage} icon={<ImageIcon className="w-3.5 h-3.5" />} label="Image" />
      <Divider />
      <ToolBtn onClick={onUndo} icon={<Undo2 className="w-3.5 h-3.5" />} label="Undo" />
      <ToolBtn onClick={onClear} icon={<X className="w-3.5 h-3.5" />} label="Clear" />
      <Divider />
      <button onClick={onDiscard} className="px-2.5 py-1.5 text-xs text-white/60 hover:text-white rounded-full transition-colors">
        Discard
      </button>
      <button
        onClick={onApply}
        disabled={isPending}
        className="px-3 py-1.5 text-xs bg-primary text-white rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
      >
        <Check className="w-3 h-3" /> Apply
      </button>
    </div>
  );
}

function ToolBtn({
  active, onClick, icon, label, size = 'sm',
}: {
  active?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  size?: 'sm' | 'lg';
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        'flex items-center gap-1.5 rounded-full transition-all',
        size === 'lg' ? 'px-3 py-2 text-sm min-h-[44px] min-w-[44px] justify-center' : 'px-2.5 py-1.5 text-xs',
        active ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
      )}
    >
      {icon}
      <span className={size === 'lg' ? 'hidden' : ''}>{label}</span>
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-white/10 mx-0.5" />;
}
