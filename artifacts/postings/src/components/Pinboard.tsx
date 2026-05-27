import React, {
  useEffect, useRef, useState, useCallback
} from 'react';
import { useGetPinboard, useSavePinboard } from '@workspace/api-client-react';
import { PinCard, PinConnection } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Maximize, Edit3, X, Loader2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Transform { x: number; y: number; scale: number }

const CARD_W_POST = 200;
const CARD_H_POST = 100;
const CARD_W_STICKY = 160;
const CARD_H_STICKY = 140;

function cardDims(c: PinCard) {
  return c.type === 'stickyNote'
    ? { w: CARD_W_STICKY, h: CARD_H_STICKY }
    : { w: CARD_W_POST, h: CARD_H_POST };
}

function cardX(c: PinCard) { return c.x ?? 0; }
function cardY(c: PinCard) { return c.y ?? 0; }

function statusColor(status: string | null) {
  if (status === 'published') return '#22c55e';
  if (status === 'in-review') return '#f59e0b';
  return '#64748b';
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, maxLines: number) {
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  for (let i = 0; i < words.length && lines < maxLines; i++) {
    const testLine = line + (line ? ' ' : '') + words[i];
    if (ctx.measureText(testLine).width > maxW && line) {
      ctx.fillText(line, x, y + lines * lineH);
      line = words[i];
      lines++;
    } else {
      line = testLine;
    }
  }
  if (lines < maxLines && line) ctx.fillText(line, x, y + lines * lineH);
}

export function Pinboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Core state
  const [cards, setCards] = useState<PinCard[]>([]);
  const [connections, setConnections] = useState<PinConnection[]>([]);
  const [transform, setTransform] = useState<Transform>({ x: 60, y: 60, scale: 1 });

  // Selection & interaction
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [boardDirty, setBoardDirty] = useState(false);

  // Sticky note creation
  const [showStickyForm, setShowStickyForm] = useState(false);
  const [stickyText, setStickyText] = useState('');

  // Group creation bar
  const [groupName, setGroupName] = useState('');

  // Load
  const { data: board, isLoading } = useGetPinboard('WR');
  const savePinboard = useSavePinboard();

  useEffect(() => {
    if (board && cards.length === 0) {
      setCards(board.cards || []);
      setConnections(board.connections || []);
    }
  }, [board]);

  // Drag state (refs to avoid re-renders during drag)
  const dragRef = useRef<{
    target: PinCard | null;
    startX: number; startY: number;
    cardStartX: number; cardStartY: number;
    mouseDownPos: { x: number; y: number };
    moved: boolean;
    panning: boolean;
    panStart: { x: number; y: number };
    transformStart: { x: number; y: number };
  }>({
    target: null, startX: 0, startY: 0,
    cardStartX: 0, cardStartY: 0,
    mouseDownPos: { x: 0, y: 0 },
    moved: false,
    panning: false,
    panStart: { x: 0, y: 0 },
    transformStart: { x: 0, y: 0 },
  });

  // ──────────────────────────────────────────────
  // Canvas helpers
  // ──────────────────────────────────────────────

  const toCanvas = useCallback((screenX: number, screenY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (screenX - rect.left - transform.x) / transform.scale,
      y: (screenY - rect.top - transform.y) / transform.scale,
    };
  }, [transform]);

  const hitTest = useCallback((px: number, py: number, cardList: PinCard[]) => {
    for (let i = cardList.length - 1; i >= 0; i--) {
      const c = cardList[i];
      const { w, h } = cardDims(c);
      const x0 = cardX(c), y0 = cardY(c);
      if (px >= x0 && px <= x0 + w && py >= y0 && py <= y0 + h) return c;
    }
    return null;
  }, []);

  // ──────────────────────────────────────────────
  // Draw
  // ──────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(dpr, dpr);

    // Dot grid
    const gSize = 32 * transform.scale;
    const offsetX = ((transform.x % gSize) + gSize) % gSize;
    const offsetY = ((transform.y % gSize) + gSize) % gSize;
    const cw = canvas.width / dpr;
    const ch = canvas.height / dpr;
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let gx = offsetX; gx < cw; gx += gSize) {
      for (let gy = offsetY; gy < ch; gy += gSize) {
        ctx.beginPath();
        ctx.arc(gx, gy, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);

    // Connections (bezier curves)
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.5;
    connections.forEach(conn => {
      const from = cards.find(c => c.id === conn.from);
      const to = cards.find(c => c.id === conn.to);
      if (!from || !to) return;
      const { w: fw, h: fh } = cardDims(from);
      const { w: tw, h: th } = cardDims(to);
      const fx = cardX(from) + fw / 2;
      const fy = cardY(from) + fh / 2;
      const tx2 = cardX(to) + tw / 2;
      const ty2 = cardY(to) + th / 2;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.bezierCurveTo(fx + (tx2 - fx) * 0.5, fy, fx + (tx2 - fx) * 0.5, ty2, tx2, ty2);
      ctx.stroke();
    });

    // Cards
    cards.forEach(card => {
      const { w, h } = cardDims(card);
      const isSelected = selectedIds.has(card.id);
      const isFocused = focusedId === card.id;
      const dimmed = focusMode && !isFocused && !selectedIds.has(card.id);

      ctx.save();
      ctx.globalAlpha = dimmed ? 0.15 : 1;

      const kx = cardX(card), ky = cardY(card);

      if (card.type === 'post') {
        // Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(kx, ky, w, h);
        ctx.shadowBlur = 0;

        // Status bar
        ctx.fillStyle = statusColor(card.status ?? null);
        ctx.fillRect(kx, ky, 5, h);

        // Text
        ctx.fillStyle = '#e8e6e0';
        ctx.font = `600 13px "DM Sans", sans-serif`;
        wrapText(ctx, card.title || 'Untitled', kx + 14, ky + 20, w - 20, 16, 2);

        ctx.fillStyle = '#666';
        ctx.font = `11px "DM Sans", sans-serif`;
        ctx.fillText(card.authorName || '', kx + 14, ky + 56);

        const dot = statusColor(card.status ?? null);
        ctx.fillStyle = dot;
        ctx.beginPath();
        ctx.arc(kx + 14 + (ctx.measureText(card.authorName || '').width) + 10, ky + 52, 3, 0, Math.PI * 2);
        ctx.fill();

      } else {
        // Sticky note
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#1e1700';
        ctx.fillRect(kx, ky, w, h);
        ctx.shadowBlur = 0;

        // Top stripe
        ctx.fillStyle = '#92400e';
        ctx.fillRect(kx, ky, w, 6);

        // Fold corner
        ctx.fillStyle = '#2d2200';
        ctx.beginPath();
        ctx.moveTo(kx + w - 16, ky + h);
        ctx.lineTo(kx + w, ky + h - 16);
        ctx.lineTo(kx + w, ky + h);
        ctx.closePath();
        ctx.fill();

        // Text
        ctx.fillStyle = '#d97706';
        ctx.font = `12px "DM Sans", sans-serif`;
        wrapText(ctx, card.noteText || '', kx + 10, ky + 24, w - 20, 16, 7);
      }

      // Selection ring
      if (isSelected && editMode) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2 / transform.scale;
        ctx.shadowColor = '#3b82f680';
        ctx.shadowBlur = 8;
        ctx.strokeRect(kx - 3, ky - 3, w + 6, h + 6);
        ctx.shadowBlur = 0;
      }

      // Focus glow
      if (isFocused && focusMode) {
        ctx.strokeStyle = '#E55A1B';
        ctx.lineWidth = 2 / transform.scale;
        ctx.shadowColor = '#E55A1B80';
        ctx.shadowBlur = 12;
        ctx.strokeRect(kx - 2, ky - 2, w + 4, h + 4);
        ctx.shadowBlur = 0;
      }

      ctx.restore();
    });

    ctx.restore();
  }, [cards, connections, transform, selectedIds, focusedId, focusMode, editMode]);

  // Init canvas size
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
    draw();
  }, [draw]);

  useEffect(() => {
    initCanvas();
    window.addEventListener('resize', initCanvas);
    return () => window.removeEventListener('resize', initCanvas);
  }, [initCanvas]);

  useEffect(() => { draw(); }, [draw]);

  // ──────────────────────────────────────────────
  // Pointer events
  // ──────────────────────────────────────────────

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const canvasPos = toCanvas(e.clientX, e.clientY);
    const hit = hitTest(canvasPos.x, canvasPos.y, cards);

    dragRef.current.mouseDownPos = { x: e.clientX, y: e.clientY };
    dragRef.current.moved = false;

    if (hit && editMode) {
      dragRef.current.target = hit;
      dragRef.current.cardStartX = hit.x ?? 0;
      dragRef.current.cardStartY = hit.y ?? 0;
      dragRef.current.startX = e.clientX;
      dragRef.current.startY = e.clientY;
      dragRef.current.panning = false;
    } else {
      dragRef.current.target = null;
      dragRef.current.panning = true;
      dragRef.current.panStart = { x: e.clientX, y: e.clientY };
      dragRef.current.transformStart = { x: transform.x, y: transform.y };
    }
  }, [toCanvas, hitTest, cards, editMode, transform]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const dx = e.clientX - dragRef.current.mouseDownPos.x;
    const dy = e.clientY - dragRef.current.mouseDownPos.y;
    if (Math.sqrt(dx * dx + dy * dy) > 3) dragRef.current.moved = true;

    if (dragRef.current.target && editMode) {
      const moveDx = (e.clientX - dragRef.current.startX) / transform.scale;
      const moveDy = (e.clientY - dragRef.current.startY) / transform.scale;
      const id = dragRef.current.target.id;
      setCards(prev => prev.map(c =>
        c.id === id
          ? { ...c, x: dragRef.current.cardStartX + moveDx, y: dragRef.current.cardStartY + moveDy }
          : c
      ));
      setBoardDirty(true);
    } else if (dragRef.current.panning) {
      setTransform(prev => ({
        ...prev,
        x: dragRef.current.transformStart.x + (e.clientX - dragRef.current.panStart.x),
        y: dragRef.current.transformStart.y + (e.clientY - dragRef.current.panStart.y),
      }));
    }
  }, [editMode, transform.scale]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    const wasDragging = dragRef.current.moved;

    if (!wasDragging) {
      // Click
      const canvasPos = toCanvas(e.clientX, e.clientY);
      const hit = hitTest(canvasPos.x, canvasPos.y, cards);

      if (editMode) {
        if (hit) {
          setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(hit.id)) next.delete(hit.id);
            else next.add(hit.id);
            return next;
          });
        } else {
          setSelectedIds(new Set());
        }
      } else {
        // Browse mode: select for context bar / focus
        if (hit) {
          setFocusedId(hit.id);
        } else {
          setFocusedId(null);
          setFocusMode(false);
        }
      }
    }

    dragRef.current.target = null;
    dragRef.current.panning = false;
  }, [toCanvas, hitTest, cards, editMode]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 50) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const delta = -e.deltaY * 0.001;
      const newScale = Math.min(Math.max(0.3, transform.scale * (1 + delta)), 4);
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      setTransform({
        scale: newScale,
        x: mouseX - (mouseX - transform.x) * (newScale / transform.scale),
        y: mouseY - (mouseY - transform.y) * (newScale / transform.scale),
      });
    } else {
      setTransform(prev => ({
        ...prev,
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  }, [transform]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') fitScreen();
      if (e.key === 'Escape') { setFocusMode(false); setFocusedId(null); setSelectedIds(new Set()); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const fitScreen = () => {
    setTransform({ x: 60, y: 60, scale: 1 });
  };

  // Edit mode toggle
  const toggleEditMode = async () => {
    if (editMode && boardDirty) {
      try {
        await savePinboard.mutateAsync({ workspace: 'WR', data: { cards, connections } });
        toast({ title: 'Board saved' });
        setBoardDirty(false);
      } catch (e: any) {
        toast({ title: 'Failed to save board', description: e.message, variant: 'destructive' });
      }
    }
    setSelectedIds(new Set());
    setEditMode(prev => !prev);
  };

  // Add sticky note
  const addSticky = () => {
    if (!stickyText.trim()) return;
    const visibleCenterX = (-transform.x + (containerRef.current?.clientWidth || 600) / 2) / transform.scale;
    const visibleCenterY = (-transform.y + (containerRef.current?.clientHeight || 400) / 2) / transform.scale;
    const jitter = () => (Math.random() - 0.5) * 40;

    const newCard: PinCard = {
      id: `sticky-${Date.now()}`,
      type: 'stickyNote',
      postId: null,
      title: 'Sticky',
      authorName: null,
      status: null,
      category: null,
      tags: [],
      noteText: stickyText.trim(),
      x: visibleCenterX - CARD_W_STICKY / 2 + jitter(),
      y: visibleCenterY - CARD_H_STICKY / 2 + jitter(),
      groupId: null,
    };
    setCards(prev => [...prev, newCard]);
    setBoardDirty(true);
    setStickyText('');
    setShowStickyForm(false);
  };

  // Group creation
  const createGroup = () => {
    if (selectedIds.size < 2) return;
    const gId = `G-${Date.now()}`;
    const selectedArr = cards.filter(c => selectedIds.has(c.id));

    // Build connections between consecutive selected cards
    const newConns: PinConnection[] = [];
    for (let i = 0; i < selectedArr.length - 1; i++) {
      const exists = connections.some(
        cn => (cn.from === selectedArr[i].id && cn.to === selectedArr[i + 1].id) ||
              (cn.from === selectedArr[i + 1].id && cn.to === selectedArr[i].id)
      );
      if (!exists) newConns.push({ from: selectedArr[i].id, to: selectedArr[i + 1].id });
    }

    setCards(prev => prev.map(c => selectedIds.has(c.id) ? { ...c, groupId: gId } : c));
    setConnections(prev => [...prev, ...newConns]);
    setBoardDirty(true);
    setGroupName('');
    setSelectedIds(new Set());
  };

  const unlinkGroup = () => {
    const groupIds = new Set(
      cards.filter(c => selectedIds.has(c.id)).map(c => c.groupId).filter(Boolean)
    );
    setCards(prev => prev.map(c =>
      selectedIds.has(c.id) ? { ...c, groupId: null } : c
    ));
    setConnections(prev => prev.filter(cn => {
      const fromCard = cards.find(c => c.id === cn.from);
      const toCard = cards.find(c => c.id === cn.to);
      return !(fromCard && selectedIds.has(fromCard.id) && toCard && selectedIds.has(toCard.id));
    }));
    setBoardDirty(true);
    setSelectedIds(new Set());
  };

  // Focus mode
  const toggleFocusMode = () => {
    if (!focusedId) return;
    setFocusMode(prev => !prev);
  };

  const focusedCard = focusedId ? cards.find(c => c.id === focusedId) : null;

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative" ref={containerRef}>
      {/* Top toolbar */}
      <div className="absolute top-3 left-3 z-10 flex gap-2 items-center">
        <Button
          variant={editMode ? 'default' : 'secondary'}
          size="sm"
          className="h-7 text-xs shadow-lg"
          onClick={toggleEditMode}
        >
          {editMode
            ? <><Check className="w-3.5 h-3.5 mr-1.5" /> {boardDirty ? 'Save & Exit' : 'Exit Edit'}</>
            : <><Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit Board</>
          }
        </Button>
        {editMode && (
          <Button
            variant="secondary"
            size="sm"
            className="h-7 text-xs shadow-lg"
            onClick={() => setShowStickyForm(prev => !prev)}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Sticky
          </Button>
        )}
      </div>

      {/* Fit screen */}
      <div className="absolute top-3 right-3 z-10">
        <Button variant="secondary" size="icon" className="h-7 w-7 shadow-lg" onClick={fitScreen}>
          <Maximize className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Sticky note creation form */}
      {showStickyForm && (
        <div className="absolute top-12 left-3 z-20 bg-surface border border-border rounded shadow-xl p-3 w-64">
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">New Sticky Note</p>
          <textarea
            autoFocus
            value={stickyText}
            onChange={e => setStickyText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addSticky(); }
              if (e.key === 'Escape') { setShowStickyForm(false); setStickyText(''); }
            }}
            placeholder="Type a note..."
            className="w-full bg-background border border-border/50 text-xs text-foreground placeholder:text-muted-foreground/40 rounded p-2 resize-none min-h-[72px] outline-none focus:border-border"
          />
          <div className="flex gap-1.5 mt-2">
            <Button size="sm" className="h-7 text-xs flex-1" onClick={addSticky} disabled={!stickyText.trim()}>
              Add
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setShowStickyForm(false); setStickyText(''); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ cursor: editMode ? 'default' : 'grab', touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      />

      {/* Context bar — browse mode, card selected */}
      {focusedCard && !editMode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-surface/90 backdrop-blur border border-border/60 rounded-lg px-4 py-3 shadow-xl flex items-center gap-4 max-w-lg w-full mx-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={cn(
                "text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm font-semibold",
                focusedCard.type === 'stickyNote' ? "bg-amber-900/40 text-amber-400" : "bg-surface text-muted-foreground border border-border/50"
              )}>
                {focusedCard.type === 'stickyNote' ? 'Note' : 'Post'}
              </span>
              {focusedCard.status && (
                <span className="text-[9px] font-semibold" style={{ color: statusColor(focusedCard.status) }}>
                  {focusedCard.status}
                </span>
              )}
            </div>
            <p className="font-semibold text-sm truncate">{focusedCard.title || focusedCard.noteText}</p>
            {focusedCard.authorName && (
              <p className="text-xs text-muted-foreground">{focusedCard.authorName}</p>
            )}
          </div>
          <Button
            variant={focusMode ? 'default' : 'secondary'}
            size="sm"
            className="h-7 text-xs shrink-0"
            onClick={toggleFocusMode}
          >
            {focusMode ? 'Exit Focus' : 'Focus'}
          </Button>
          <button
            onClick={() => { setFocusedId(null); setFocusMode(false); }}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Group action bar — edit mode, 2+ selected */}
      {editMode && selectedIds.size >= 2 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-surface/90 backdrop-blur border border-border/60 rounded-lg px-4 py-3 shadow-xl flex items-center gap-3 max-w-lg w-full mx-4">
          <span className="text-xs text-muted-foreground shrink-0">{selectedIds.size} selected</span>
          <Input
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            placeholder="Group name..."
            className="h-7 text-xs bg-background border-border/50 flex-1"
            onKeyDown={e => { if (e.key === 'Enter') createGroup(); }}
          />
          <Button size="sm" className="h-7 text-xs shrink-0" onClick={createGroup}>
            Group
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs border-border/50 shrink-0" onClick={unlinkGroup}>
            Unlink
          </Button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
