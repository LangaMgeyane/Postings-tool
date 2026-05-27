import React, { useRef, useState, useEffect } from 'react';
import { useCreateAnnotation } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Post, Stroke, TextAnnotation } from '@workspace/api-client-react';
import { Undo2, X, Check, PenTool, Type } from 'lucide-react';
import { getSession } from '@/session';

interface AnnotationOverlayProps {
  post: Post;
  onClose: () => void;
}

export function AnnotationOverlay({ post, onClose }: AnnotationOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const session = getSession();
  
  const [mode, setMode] = useState<'draw' | 'text'>('draw');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [texts, setTexts] = useState<TextAnnotation[]>([]);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  
  const [activeTextInput, setActiveTextInput] = useState<{x: number, y: number} | null>(null);
  const [textInputValue, setTextInputValue] = useState('');

  const createAnnotation = useCreateAnnotation();

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const w = canvas.width;
    const h = canvas.height;
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ffffff';

    const drawStroke = (s: Stroke) => {
      if (!s.points || s.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo((s.points[0].x || 0) * w, (s.points[0].y || 0) * h);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo((s.points[i].x || 0) * w, (s.points[i].y || 0) * h);
      }
      ctx.stroke();
    };

    strokes.forEach(drawStroke);
    if (currentStroke) drawStroke(currentStroke);
    
    ctx.shadowBlur = 0;
    ctx.font = 'bold 20px "DM Sans"';
    ctx.fillStyle = '#E55A1B';
    texts.forEach(t => {
      ctx.fillText(t.text || '', (t.x || 0) * w, (t.y || 0) * h);
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    redraw();
  }, [strokes, texts, currentStroke]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height
    };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (mode === 'draw') {
      setIsDrawing(true);
      setCurrentStroke({ points: [getPos(e)] });
    } else if (mode === 'text' && !activeTextInput) {
      setActiveTextInput(getPos(e));
      setTextInputValue('');
    }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || mode !== 'draw' || !currentStroke) return;
    setCurrentStroke(prev => ({
      ...prev,
      points: [...(prev?.points || []), getPos(e)]
    }));
  };

  const handlePointerUp = () => {
    if (mode === 'draw' && isDrawing && currentStroke) {
      setStrokes(prev => [...prev, currentStroke]);
      setCurrentStroke(null);
      setIsDrawing(false);
    }
  };

  const handleTextCommit = (e: React.KeyboardEvent | React.FocusEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    if (textInputValue.trim() && activeTextInput) {
      setTexts(prev => [...prev, { x: activeTextInput.x, y: activeTextInput.y, text: textInputValue.trim() }]);
    }
    setActiveTextInput(null);
  };

  const undo = () => {
    if (mode === 'draw') setStrokes(s => s.slice(0, -1));
    else setTexts(t => t.slice(0, -1));
  };

  const handleApply = async () => {
    if (!strokes.length && !texts.length) return onClose();
    try {
      await createAnnotation.mutateAsync({
        postId: post.id,
        data: {
          type: strokes.length > 0 ? 'drawing' : 'text',
          strokes,
          texts,
          text: texts.map(t => t.text).join(' ')
        }
      });
      toast({ title: 'Annotation saved' });
      onClose();
    } catch (e: any) {
      toast({ title: 'Failed to save', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex flex-col">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-surface border border-border rounded-full shadow-lg p-1 flex gap-1 z-50">
        <Button variant={mode === 'draw' ? 'default' : 'ghost'} size="sm" className="rounded-full" onClick={() => setMode('draw')}>
          <PenTool className="w-4 h-4 mr-2" /> ✏ Draw
        </Button>
        <Button variant={mode === 'text' ? 'default' : 'ghost'} size="sm" className="rounded-full" onClick={() => setMode('text')}>
          <Type className="w-4 h-4 mr-2" /> T Text
        </Button>
        <div className="w-px h-6 bg-border mx-1 my-auto" />
        <Button variant="ghost" size="sm" className="rounded-full" onClick={undo}><Undo2 className="w-4 h-4 mr-2" /> ↩ Undo</Button>
        <Button variant="ghost" size="sm" className="rounded-full text-destructive" onClick={() => {setStrokes([]); setTexts([]);}}><X className="w-4 h-4 mr-2" /> ✕ Clear</Button>
        <div className="w-px h-6 bg-border mx-1 my-auto" />
        <Button variant="ghost" size="sm" className="rounded-full" onClick={onClose}>Discard</Button>
        <Button variant="default" size="sm" className="rounded-full bg-primary text-primary-foreground" onClick={handleApply} disabled={createAnnotation.isPending}><Check className="w-4 h-4 mr-2" /> Apply</Button>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair touch-none"
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      />

      {activeTextInput && (
        <input
          autoFocus
          className="absolute bg-background border border-primary text-primary px-2 py-1 outline-none font-bold text-lg rounded shadow-lg"
          style={{ 
            left: `${activeTextInput.x * 100}%`, 
            top: `${activeTextInput.y * 100}%`,
            transform: 'translateY(-50%)'
          }}
          value={textInputValue}
          onChange={e => setTextInputValue(e.target.value)}
          onKeyDown={handleTextCommit}
          onBlur={handleTextCommit}
        />
      )}
    </div>
  );
}
