import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useCreateAnnotation, getListAnnotationsQueryKey } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Post } from '@workspace/api-client-react';
import { Undo2, X, Check, PenTool, Type } from 'lucide-react';
import { getSession } from '@/session';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface AnnotationOverlayProps {
  post: Post;
  onClose: () => void;
}

export function AnnotationOverlay({ post, onClose }: AnnotationOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const session = getSession();

  const [mode, setMode] = useState<'draw' | 'text'>('draw');

  // State via refs to avoid stale closures in canvas handlers
  const strokes = useRef<Array<{ points: Array<{ x: number; y: number }> }>>([]);
  const texts = useRef<Array<{ x: number; y: number; text: string }>>([]);
  const [strokesVer, setStrokesVer] = useState(0);
  const [textsVer, setTextsVer] = useState(0);
  const isDrawing = useRef(false);
  const currentStroke = useRef<Array<{ x: number; y: number }>>([]);

  // Text input state — position is in pixels relative to the container
  const [textPos, setTextPos] = useState<{ px: number; py: number; nx: number; ny: number } | null>(null);
  const [textValue, setTextValue] = useState('');
  const textInputRef = useRef<HTMLInputElement>(null);

  const createAnnotation = useCreateAnnotation();

  // ── Canvas draw ─────────────────────────────────────────────────────────────
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(255,255,255,0.7)';

    const drawStroke = (pts: Array<{ x: number; y: number }>) => {
      if (pts.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x * w, pts[0].y * h);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * w, pts[i].y * h);
      ctx.stroke();
    };

    strokes.current.forEach(s => drawStroke(s.points));
    if (isDrawing.current && currentStroke.current.length > 1) drawStroke(currentStroke.current);

    ctx.shadowBlur = 0;
    ctx.font = 'bold 18px "DM Sans", sans-serif';
    ctx.fillStyle = '#E55A1B';
    texts.current.forEach(t => ctx.fillText(t.text, t.x * w, t.y * h));

    ctx.restore();
  }, []);

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

  // Focus text input when it appears
  useEffect(() => {
    if (textPos) setTimeout(() => textInputRef.current?.focus(), 20);
  }, [textPos]);

  // ── Pointer position — always relative to the container ────────────────────
  const getPos = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return { px: 0, py: 0, nx: 0, ny: 0 };
    const rect = container.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    return { px, py, nx: px / rect.width, ny: py / rect.height };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (textPos) return; // text input active, ignore canvas clicks
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = getPos(e.clientX, e.clientY);

    if (mode === 'draw') {
      isDrawing.current = true;
      currentStroke.current = [{ x: pos.nx, y: pos.ny }];
    } else if (mode === 'text') {
      setTextPos(pos);
      setTextValue('');
    }
  }, [mode, textPos, getPos]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawing.current || mode !== 'draw') return;
    const pos = getPos(e.clientX, e.clientY);
    currentStroke.current = [...currentStroke.current, { x: pos.nx, y: pos.ny }];
    redraw();
  }, [mode, getPos, redraw]);

  const handlePointerUp = useCallback(() => {
    if (mode === 'draw' && isDrawing.current && currentStroke.current.length > 1) {
      strokes.current = [...strokes.current, { points: currentStroke.current }];
      setStrokesVer(v => v + 1);
    }
    currentStroke.current = [];
    isDrawing.current = false;
  }, [mode]);

  const commitText = useCallback(() => {
    if (textValue.trim() && textPos) {
      texts.current = [...texts.current, { x: textPos.nx, y: textPos.ny, text: textValue.trim() }];
      setTextsVer(v => v + 1);
    }
    setTextPos(null);
    setTextValue('');
  }, [textValue, textPos]);

  const cancelText = useCallback(() => { setTextPos(null); setTextValue(''); }, []);

  const undo = useCallback(() => {
    if (mode === 'draw') { strokes.current = strokes.current.slice(0, -1); setStrokesVer(v => v + 1); }
    else { texts.current = texts.current.slice(0, -1); setTextsVer(v => v + 1); }
  }, [mode]);

  const clear = useCallback(() => {
    strokes.current = []; texts.current = [];
    setStrokesVer(v => v + 1); setTextsVer(v => v + 1);
  }, []);

  const handleApply = async () => {
    if (!strokes.current.length && !texts.current.length) { onClose(); return; }
    if (!session) return;
    try {
      await createAnnotation.mutateAsync({
        postId: post.id,
        data: {
          type: strokes.current.length > 0 ? 'drawing' : 'text',
          strokes: strokes.current.map(s => ({ points: s.points })),
          texts: texts.current,
          text: texts.current.map(t => t.text).join(' '),
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
      if (e.key === 'Escape') { if (textPos) cancelText(); else onClose(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if (!textPos && e.key === 'd') setMode('draw');
      if (!textPos && e.key === 't') setMode('text');
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [textPos, onClose, undo, cancelText]);

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[1px]" />

      {/* Desktop toolbar — top center */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 max-md:hidden">
        <AnnotationToolbar
          mode={mode}
          onMode={setMode}
          onUndo={undo}
          onClear={clear}
          onDiscard={onClose}
          onApply={handleApply}
          isPending={createAnnotation.isPending}
        />
      </div>

      {/* Canvas — positioned relative to container for correct text input placement */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ cursor: mode === 'text' ? 'text' : 'crosshair', touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* Text input — positioned using container-relative px/py */}
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

      {/* Mobile toolbar — full-width bottom dock */}
      <div className="absolute bottom-0 left-0 right-0 z-20 md:hidden safe-area-bottom">
        <AnnotationToolbar
          mode={mode}
          onMode={setMode}
          onUndo={undo}
          onClear={clear}
          onDiscard={onClose}
          onApply={handleApply}
          isPending={createAnnotation.isPending}
          mobile
        />
      </div>
    </div>
  );
}

// ── Shared annotation toolbar ──────────────────────────────────────────────────

function AnnotationToolbar({
  mode, onMode, onUndo, onClear, onDiscard, onApply, isPending, mobile = false,
}: {
  mode: 'draw' | 'text';
  onMode: (m: 'draw' | 'text') => void;
  onUndo: () => void;
  onClear: () => void;
  onDiscard: () => void;
  onApply: () => void;
  isPending: boolean;
  mobile?: boolean;
}) {
  if (mobile) {
    return (
      <div className="bg-black/80 backdrop-blur border-t border-white/10 px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex gap-1">
          <ToolBtn active={mode === 'draw'} onClick={() => onMode('draw')} label="Draw" icon={<PenTool className="w-4 h-4" />} size="lg" />
          <ToolBtn active={mode === 'text'} onClick={() => onMode('text')} label="Text" icon={<Type className="w-4 h-4" />} size="lg" />
        </div>
        <div className="flex gap-1">
          <ToolBtn onClick={onUndo} icon={<Undo2 className="w-4 h-4" />} label="Undo" size="lg" />
          <ToolBtn onClick={onClear} icon={<X className="w-4 h-4" />} label="Clear" size="lg" />
        </div>
        <div className="flex gap-1">
          <button onClick={onDiscard} className="px-3 py-2 text-xs text-white/60 hover:text-white rounded min-h-[44px] min-w-[44px]">Discard</button>
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
      <ToolBtn active={mode === 'draw'} onClick={() => onMode('draw')} icon={<PenTool className="w-3.5 h-3.5" />} label="Draw" />
      <ToolBtn active={mode === 'text'} onClick={() => onMode('text')} icon={<Type className="w-3.5 h-3.5" />} label="Text" />
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
