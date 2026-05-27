import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useGetPinboard, useSavePinboard } from '@workspace/api-client-react';
import { PinCard, PinConnection } from '@workspace/api-client-react';
import { getSession } from '@/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Maximize, Filter, Edit3, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Transform { x: number; y: number; scale: number }

export function Pinboard() {
  const session = getSession();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [editMode, setEditMode] = useState(false);
  
  const [cards, setCards] = useState<PinCard[]>([]);
  const [connections, setConnections] = useState<PinConnection[]>([]);
  
  const { data: board, isLoading } = useGetPinboard('WR');
  const savePinboard = useSavePinboard();

  useEffect(() => {
    if (board && cards.length === 0 && !editMode) {
      setCards(board.cards || []);
      setConnections(board.connections || []);
    }
  }, [board, editMode, cards.length]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);

    // Draw grid
    ctx.fillStyle = '#222';
    const gridSize = 50;
    // Just drawing dots for a subtle background
    
    // Draw connections
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    connections.forEach(conn => {
      const fromCard = cards.find(c => c.id === conn.from);
      const toCard = cards.find(c => c.id === conn.to);
      if (fromCard && toCard) {
        ctx.beginPath();
        ctx.moveTo((fromCard.x || 0) + 100, (fromCard.y || 0) + 50); // Rough center
        ctx.lineTo((toCard.x || 0) + 100, (toCard.y || 0) + 50);
        ctx.stroke();
      }
    });

    // Draw cards
    cards.forEach(card => {
      ctx.save();
      ctx.translate(card.x || 0, card.y || 0);
      
      if (card.type === 'post') {
        ctx.fillStyle = '#1e1e1e';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.fillRect(0, 0, 200, 100);
        
        ctx.fillStyle = card.status === 'published' ? '#22c55e' : card.status === 'in-review' ? '#f59e0b' : '#64748b';
        ctx.fillRect(0, 0, 6, 100);
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px "DM Sans"';
        const title = card.title || 'Untitled';
        ctx.fillText(title.substring(0, 20) + (title.length > 20 ? '...' : ''), 16, 24);
        
        ctx.fillStyle = '#888';
        ctx.font = '12px "DM Sans"';
        ctx.fillText(card.authorName || 'Unknown', 16, 44);
      } else {
        // Sticky note
        ctx.fillStyle = '#2a2000';
        ctx.fillRect(0, 0, 160, 160);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(0, 0, 160, 8);
        
        ctx.fillStyle = '#f59e0b';
        ctx.font = '14px "DM Sans"';
        const text = card.noteText || '';
        const lines = text.match(/.{1,20}/g) || [];
        lines.slice(0, 7).forEach((line, i) => {
          ctx.fillText(line, 12, 30 + (i * 20));
        });
      }
      ctx.restore();
    });

    ctx.restore();
  }, [cards, connections, transform]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const handleResize = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        draw();
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  useEffect(() => {
    draw();
  }, [draw, transform, cards]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setTransform(prev => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const delta = -e.deltaY * zoomSensitivity;
      const newScale = Math.min(Math.max(0.3, transform.scale * (1 + delta)), 4);
      
      // Keep pointer at same logical position
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const newX = mouseX - (mouseX - transform.x) * (newScale / transform.scale);
        const newY = mouseY - (mouseY - transform.y) * (newScale / transform.scale);
        setTransform({ x: newX, y: newY, scale: newScale });
      }
    } else {
      setTransform(prev => ({
        ...prev,
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  const toggleEditMode = async () => {
    if (editMode) {
      try {
        await savePinboard.mutateAsync({
          workspace: 'WR',
          data: { cards, connections }
        });
        toast({ title: 'Board saved' });
      } catch (e: any) {
        toast({ title: 'Failed to save board', description: e.message, variant: 'destructive' });
      }
    }
    setEditMode(!editMode);
  };

  if (isLoading) return <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="h-full flex flex-col relative" ref={containerRef}>
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <Button variant={editMode ? 'default' : 'secondary'} size="sm" onClick={toggleEditMode}>
          {editMode ? <><SaveIcon className="w-4 h-4 mr-2" /> Save Board</> : <><Edit3 className="w-4 h-4 mr-2" /> Edit Board</>}
        </Button>
        {editMode && (
          <Button variant="secondary" size="sm" onClick={() => {
            setCards(prev => [...prev, {
              id: Math.random().toString(36).substr(2, 9),
              type: 'stickyNote',
              noteText: 'New Sticky Note',
              x: -transform.x / transform.scale + 200,
              y: -transform.y / transform.scale + 200
            } as PinCard]);
          }}>
            <Plus className="w-4 h-4 mr-2" /> Sticky
          </Button>
        )}
      </div>
      
      <div className="absolute bottom-4 right-4 z-10 flex gap-2">
        <Button variant="secondary" size="icon" onClick={() => setTransform({x: 0, y: 0, scale: 1})}>
          <Maximize className="w-4 h-4" />
        </Button>
      </div>

      <canvas
        ref={canvasRef}
        className="flex-1 w-full touch-none cursor-grab active:cursor-grabbing bg-base"
        style={{ width: '100%', height: '100%' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      />
    </div>
  );
}

function SaveIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
      <polyline points="17 21 17 13 7 13 7 21"></polyline>
      <polyline points="7 3 7 8 15 8"></polyline>
    </svg>
  );
}
