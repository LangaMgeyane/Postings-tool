import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useCreateAnnotation, getListAnnotationsQueryKey } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Post, Stroke, TextAnnotation } from '@workspace/api-client-react';
import { Undo2, X, Check, PenTool, Type } from 'lucide-react';
import { getSession } from '@/session';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface AnnotationOverlayProps {
  post: Post;
  onClose: () => void;
}

export function AnnotationOverlay({ post, onClose }: AnnotationOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const session = getSession();

  const [mode, setMode] = useState<'draw' | 'text'>('draw');

  // All state declared before any function references — avoids TDZ
  const strokes = useRef<Stroke[]>([]);
  const texts = useRef<TextAnnotation[]>([]);
  const [strokesVersion, setStrokesVersion] = useState(0);
  const [textsVersion, setTextsVersion] = useState(0);

  const isDrawing = useRef(false);
  const currentStroke = useRef<{ x: number; y: number }[]>([]);

  const [activeTextPos, setActiveTextPos] = useState<{ x: number; y: number; screenX: number; screenY: number } | null>(null);
  const [textInputValue, setTextInputValue] = useState('');

  const createAnnotation = useCreateAnnotation();

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
    ctx.shadowColor = 'rgba(255,255,255,0.8)';

    const drawStroke = (points: Array<{ x?: number; y?: number }>) => {
      if (!points || points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo((points[0].x ?? 0) * w, (points[0].y ?? 0) * h);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo((points[i].x ?? 0) * w, (points[i].y ?? 0) * h);
      }
      ctx.stroke();
    };

    strokes.current.forEach(s => drawStroke(s.points || []));
    if (isDrawing.current && currentStroke.current.length > 1) {
      drawStroke(currentStroke.current);
    }

    ctx.shadowBlur = 0;
    ctx.font = 'bold 18px "DM Sans", sans-serif';
    ctx.fillStyle = '#E55A1B';
    texts.current.forEach(t => {
      ctx.fillText(t.text || '', (t.x ?? 0) * w, (t.y ?? 0) * h);
    });

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

  useEffect(() => {
    redraw();
  }, [strokesVersion, textsVersion, redraw]);

  const getCanvasPos = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (activeTextPos) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    if (mode === 'draw') {
      isDrawing.current = true;
      const pos = getCanvasPos(e.clientX, e.clientY);
      currentStroke.current = [pos];
    } else if (mode === 'text') {
      const canvas = canvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      if (!rect) return;
      const pos = getCanvasPos(e.clientX, e.clientY);
      setActiveTextPos({
        x: pos.x,
        y: pos.y,
        screenX: e.clientX - rect.left,
        screenY: e.clientY - rect.top,
      });
      setTextInputValue('');
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing.current || mode !== 'draw') return;
    const pos = getCanvasPos(e.clientX, e.clientY);
    currentStroke.current = [...currentStroke.current, pos];
    redraw();
  };

  const handlePointerUp = () => {
    if (mode === 'draw' && isDrawing.current) {
      if (currentStroke.current.length > 1) {
        strokes.current = [...strokes.current, { points: currentStroke.current }];
        setStrokesVersion(v => v + 1);
      }
      currentStroke.current = [];
      isDrawing.current = false;
    }
  };

  const commitText = () => {
    if (textInputValue.trim() && activeTextPos) {
      texts.current = [...texts.current, {
        x: activeTextPos.x,
        y: activeTextPos.y,
        text: textInputValue.trim(),
      }];
      setTextsVersion(v => v + 1);
    }
    setActiveTextPos(null);
    setTextInputValue('');
  };

  const cancelText = () => {
    setActiveTextPos(null);
    setTextInputValue('');
  };

  const undo = () => {
    if (mode === 'draw') {
      strokes.current = strokes.current.slice(0, -1);
      setStrokesVersion(v => v + 1);
    } else {
      texts.current = texts.current.slice(0, -1);
      setTextsVersion(v => v + 1);
    }
  };

  const clear = () => {
    strokes.current = [];
    texts.current = [];
    setStrokesVersion(v => v + 1);
    setTextsVersion(v => v + 1);
  };

  const handleApply = async () => {
    if (!strokes.current.length && !texts.current.length) {
      onClose();
      return;
    }
    if (!session) return;

    const textPreview = texts.current.map(t => t.text).join(' ');

    try {
      await createAnnotation.mutateAsync({
        postId: post.id,
        data: {
          type: strokes.current.length > 0 ? 'drawing' : 'text',
          strokes: strokes.current,
          texts: texts.current,
          text: textPreview,
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeTextPos) { cancelText(); return; }
        onClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if (e.key === 'd' || e.key === 'D') setMode('draw');
      if (e.key === 't' || e.key === 'T') setMode('text');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTextPos, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" ref={containerRef}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />

      {/* Toolbar — top center on desktop, bottom on mobile */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-black/70 border border-white/10 backdrop-blur rounded-full px-2 py-1 shadow-lg max-md:top-auto max-md:bottom-6 max-md:translate-x-0 max-md:left-4 max-md:right-4 max-md:rounded-xl max-md:justify-center">
        <ToolBtn active={mode === 'draw'} onClick={() => setMode('draw')}>
          <PenTool className="w-3.5 h-3.5" /> <span>Draw</span>
        </ToolBtn>
        <ToolBtn active={mode === 'text'} onClick={() => setMode('text')}>
          <Type className="w-3.5 h-3.5" /> <span>Text</span>
        </ToolBtn>
        <div className="w-px h-5 bg-white/10 mx-1" />
        <ToolBtn onClick={undo}>
          <Undo2 className="w-3.5 h-3.5" /> <span>Undo</span>
        </ToolBtn>
        <ToolBtn onClick={clear}>
          <X className="w-3.5 h-3.5" /> <span>Clear</span>
        </ToolBtn>
        <div className="w-px h-5 bg-white/10 mx-1" />
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs text-white/60 hover:text-white transition-colors rounded-full"
        >
          Discard
        </button>
        <button
          onClick={handleApply}
          disabled={createAnnotation.isPending}
          className="px-3 py-1.5 text-xs bg-primary text-white rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          <Check className="w-3 h-3" /> Apply
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ cursor: mode === 'text' ? 'text' : 'crosshair', touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {activeTextPos && (
        <input
          autoFocus
          value={textInputValue}
          onChange={e => setTextInputValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commitText(); }
            if (e.key === 'Escape') { e.preventDefault(); cancelText(); }
          }}
          onBlur={commitText}
          className="absolute z-20 bg-black/40 backdrop-blur-sm border border-primary/50 text-primary px-3 py-1.5 text-base font-bold rounded outline-none min-w-[120px]"
          style={{
            left: `${activeTextPos.screenX}px`,
            top: `${activeTextPos.screenY}px`,
            transform: 'translate(-4px, -50%)',
          }}
          placeholder="Type text…"
        />
      )}
    </div>
  );
}

function ToolBtn({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-full transition-all min-h-[36px]",
        active
          ? "bg-white/20 text-white"
          : "text-white/60 hover:text-white hover:bg-white/10"
      )}
    >
      {children}
    </button>
  );
}
