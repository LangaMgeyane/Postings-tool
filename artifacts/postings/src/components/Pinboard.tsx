import React, {
  useEffect, useRef, useState, useCallback
} from 'react';
import { useGetPinboard, useSavePinboard } from '@workspace/api-client-react';
import { PinCard, PinConnection } from '@workspace/api-client-react';
import { getSession } from '@/session';
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
const GROUP_PADDING = 24;

function cardDims(c: PinCard) {
  return c.type === 'stickyNote'
    ? { w: CARD_W_STICKY, h: CARD_H_STICKY }
    : { w: CARD_W_POST, h: CARD_H_POST };
}
function cardX(c: PinCard) { return c.x ?? 0; }
function cardY(c: PinCard) { return c.y ?? 0; }

function statusColor(s: string | null) {
  if (s === 'published') return '#22c55e';
  if (s === 'in-review') return '#f59e0b';
  return '#64748b';
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, maxLines: number) {
  const words = text.split(' ');
  let line = '', lines = 0;
  for (let i = 0; i < words.length && lines < maxLines; i++) {
    const test = line + (line ? ' ' : '') + words[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y + lines * lineH);
      line = words[i]; lines++;
    } else { line = test; }
  }
  if (lines < maxLines && line) ctx.fillText(line, x, y + lines * lineH);
}

// Compute the bounding box for a group of cards
function groupBounds(members: PinCard[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  members.forEach(c => {
    const x = cardX(c), y = cardY(c);
    const { w, h } = cardDims(c);
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h);
  });
  return {
    x: minX - GROUP_PADDING, y: minY - GROUP_PADDING,
    w: maxX - minX + GROUP_PADDING * 2, h: maxY - minY + GROUP_PADDING * 2,
  };
}

export function Pinboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const session = getSession();

  const [cards, setCards] = useState<PinCard[]>([]);
  const [connections, setConnections] = useState<PinConnection[]>([]);
  const [groups, setGroups] = useState<Record<string, string>>({}); // groupId → name
  const [transform, setTransform] = useState<Transform>({ x: 60, y: 60, scale: 1 });
  const [loaded, setLoaded] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [boardDirty, setBoardDirty] = useState(false);

  const [showStickyForm, setShowStickyForm] = useState(false);
  const [stickyText, setStickyText] = useState('');
  const [groupName, setGroupName] = useState('');

  // Inline group rename
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Sync dirty state refs for autosave on unmount
  const cardsRef = useRef<PinCard[]>([]);
  const connectionsRef = useRef<PinConnection[]>([]);
  const boardDirtyRef = useRef(false);
  useEffect(() => { cardsRef.current = cards; }, [cards]);
  useEffect(() => { connectionsRef.current = connections; }, [connections]);
  useEffect(() => { boardDirtyRef.current = boardDirty; }, [boardDirty]);

  const { data: board, isLoading } = useGetPinboard('WR');
  const savePinboard = useSavePinboard();

  // Load from server once
  useEffect(() => {
    if (board && !loaded) {
      setCards(board.cards || []);
      setConnections(board.connections || []);
      setLoaded(true);
    }
  }, [board, loaded]);

  // Auto-center on selected post's pin after loading
  useEffect(() => {
    if (!loaded || !session?.selectedPostId) return;
    const card = cardsRef.current.find(c => c.postId === session.selectedPostId);
    if (!card || !containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const { w, h } = cardDims(card);
    const newX = cw / 2 - (cardX(card) + w / 2);
    const newY = ch / 2 - (cardY(card) + h / 2);
    setTransform({ x: newX, y: newY, scale: 1 });
    setFocusedId(card.id);
  }, [loaded, session?.selectedPostId]);

  // Autosave after 2s debounce when dirty
  useEffect(() => {
    if (!boardDirty) return;
    const t = setTimeout(async () => {
      try {
        await savePinboard.mutateAsync({ workspace: 'WR', data: { cards, connections } });
        setBoardDirty(false);
      } catch {}
    }, 2000);
    return () => clearTimeout(t);
  }, [boardDirty, cards, connections]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (boardDirtyRef.current && cardsRef.current.length > 0) {
        fetch(`${window.location.origin}${import.meta.env.BASE_URL}api/postings/pinboard/WR`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cards: cardsRef.current, connections: connectionsRef.current }),
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, []);

  // ── Drag state ref ──────────────────────────────────────────────────────────
  const dragRef = useRef({
    target: null as PinCard | null,
    startX: 0, startY: 0,
    cardStartX: 0, cardStartY: 0,
    mouseDownPos: { x: 0, y: 0 },
    moved: false,
    panning: false,
    panStart: { x: 0, y: 0 },
    transformStart: { x: 0, y: 0 },
    lastTap: 0,
    lastTapTarget: null as string | null,
  });

  // ── Canvas helpers ──────────────────────────────────────────────────────────
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

  // Hit test group label area (above bounding rect)
  const hitGroupLabel = useCallback((px: number, py: number, cardList: PinCard[], groupMap: Record<string, string>) => {
    const groupIds = [...new Set(cardList.map(c => c.groupId).filter(Boolean) as string[])];
    for (const gId of groupIds) {
      const members = cardList.filter(c => c.groupId === gId);
      if (members.length === 0) continue;
      const bounds = groupBounds(members);
      const labelY = bounds.y - 4;
      const labelX = bounds.x + 12;
      const name = groupMap[gId] || 'Group';
      // Approximate label bounding box
      if (px >= labelX && px <= labelX + name.length * 7 + 10 && py >= labelY - 14 && py <= labelY + 2) {
        return gId;
      }
    }
    return null;
  }, []);

  // ── Draw ────────────────────────────────────────────────────────────────────
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

    // Dot grid background
    const cw = canvas.width / dpr, ch = canvas.height / dpr;
    const gSize = 32 * transform.scale;
    const offsetX = ((transform.x % gSize) + gSize) % gSize;
    const offsetY = ((transform.y % gSize) + gSize) % gSize;
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (let gx = offsetX; gx < cw; gx += gSize) {
      for (let gy = offsetY; gy < ch; gy += gSize) {
        ctx.beginPath();
        ctx.arc(gx, gy, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);

    // ── Group bounding containers ─────────────────────────────────────────
    const groupIds = [...new Set(cards.map(c => c.groupId).filter(Boolean) as string[])];
    groupIds.forEach(gId => {
      const members = cards.filter(c => c.groupId === gId);
      if (members.length === 0) return;
      const b = groupBounds(members);
      const name = groups[gId] || 'Group';

      ctx.save();
      // Filled container
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      ctx.strokeStyle = renamingGroupId === gId ? 'rgba(229,90,27,0.4)' : 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1 / transform.scale;
      ctx.beginPath();
      const r = 14;
      ctx.roundRect(b.x, b.y, b.w, b.h, r);
      ctx.fill();
      ctx.stroke();

      // Group name label — drawn above the container
      ctx.fillStyle = renamingGroupId === gId ? 'rgba(229,90,27,0.8)' : 'rgba(255,255,255,0.25)';
      ctx.font = `600 11px "DM Sans", sans-serif`;
      ctx.fillText(name.toUpperCase(), b.x + 12, b.y - 6);
      ctx.restore();
    });

    // ── Bezier connections ────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1.5;
    connections.forEach(conn => {
      const from = cards.find(c => c.id === conn.from);
      const to = cards.find(c => c.id === conn.to);
      if (!from || !to) return;
      const { w: fw, h: fh } = cardDims(from);
      const { w: tw, h: th } = cardDims(to);
      const fx = cardX(from) + fw / 2, fy = cardY(from) + fh / 2;
      const tx2 = cardX(to) + tw / 2, ty2 = cardY(to) + th / 2;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.bezierCurveTo(fx + (tx2 - fx) * 0.5, fy, fx + (tx2 - fx) * 0.5, ty2, tx2, ty2);
      ctx.stroke();
    });

    // ── Cards ─────────────────────────────────────────────────────────────
    cards.forEach(card => {
      const { w, h } = cardDims(card);
      const kx = cardX(card), ky = cardY(card);
      const isSelected = selectedIds.has(card.id);
      const isFocused = focusedId === card.id;
      const dimmed = focusMode && !isFocused && !isSelected;

      ctx.save();
      ctx.globalAlpha = dimmed ? 0.12 : 1;

      if (card.type === 'post') {
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#181818';
        ctx.fillRect(kx, ky, w, h);
        ctx.shadowBlur = 0;

        ctx.fillStyle = statusColor(card.status ?? null);
        ctx.fillRect(kx, ky, 5, h);

        ctx.fillStyle = '#e2e0da';
        ctx.font = `600 13px "DM Sans", sans-serif`;
        wrapText(ctx, card.title || 'Untitled', kx + 14, ky + 20, w - 22, 16, 2);

        ctx.fillStyle = '#555';
        ctx.font = `11px "DM Sans", sans-serif`;
        ctx.fillText(card.authorName || '', kx + 14, ky + 56);

        const sc = statusColor(card.status ?? null);
        ctx.fillStyle = sc;
        ctx.beginPath();
        ctx.arc(kx + 14 + (ctx.measureText(card.authorName || '').width) + 8, ky + 52, 3, 0, Math.PI * 2);
        ctx.fill();

        if (card.category) {
          ctx.fillStyle = '#3a3a3a';
          ctx.font = `10px "DM Sans", sans-serif`;
          ctx.fillText(card.category.toUpperCase(), kx + 14, ky + 74);
        }

      } else {
        // Sticky note
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#1e1700';
        ctx.fillRect(kx, ky, w, h);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#92400e';
        ctx.fillRect(kx, ky, w, 6);

        // Fold corner
        ctx.fillStyle = '#2d2200';
        ctx.beginPath();
        ctx.moveTo(kx + w - 18, ky + h);
        ctx.lineTo(kx + w, ky + h - 18);
        ctx.lineTo(kx + w, ky + h);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#d97706';
        ctx.font = `12px "DM Sans", sans-serif`;
        wrapText(ctx, card.noteText || '', kx + 10, ky + 24, w - 20, 16, 7);
      }

      // Selection ring
      if (isSelected && editMode) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2 / transform.scale;
        ctx.shadowColor = '#3b82f640';
        ctx.shadowBlur = 10;
        ctx.strokeRect(kx - 3, ky - 3, w + 6, h + 6);
        ctx.shadowBlur = 0;
      }

      // Focus glow
      if (isFocused) {
        ctx.strokeStyle = '#E55A1B';
        ctx.lineWidth = 2 / transform.scale;
        ctx.shadowColor = '#E55A1B60';
        ctx.shadowBlur = 14;
        ctx.strokeRect(kx - 2, ky - 2, w + 4, h + 4);
        ctx.shadowBlur = 0;
      }

      ctx.restore();
    });

    ctx.restore();
  }, [cards, connections, groups, transform, selectedIds, focusedId, focusMode, editMode, renamingGroupId]);

  // Canvas init + resize
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

  // ── Pointer events ──────────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = toCanvas(e.clientX, e.clientY);
    const hit = hitTest(pos.x, pos.y, cards);

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
      const pos = toCanvas(e.clientX, e.clientY);
      const hit = hitTest(pos.x, pos.y, cards);

      // Double-click on group label → rename
      const now = Date.now();
      const gLabelHit = hitGroupLabel(pos.x, pos.y, cards, groups);
      if (gLabelHit && now - dragRef.current.lastTap < 350 && dragRef.current.lastTapTarget === gLabelHit) {
        setRenamingGroupId(gLabelHit);
        setRenameValue(groups[gLabelHit] || '');
        setTimeout(() => renameInputRef.current?.focus(), 50);
      }
      dragRef.current.lastTap = now;
      dragRef.current.lastTapTarget = gLabelHit;

      if (editMode) {
        if (hit) {
          setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(hit.id)) next.delete(hit.id); else next.add(hit.id);
            return next;
          });
        } else if (!gLabelHit) {
          setSelectedIds(new Set());
        }
      } else {
        if (hit) {
          setFocusedId(hit.id);
        } else if (!gLabelHit) {
          setFocusedId(null);
          setFocusMode(false);
        }
      }
    }

    dragRef.current.target = null;
    dragRef.current.panning = false;
  }, [toCanvas, hitTest, hitGroupLabel, cards, editMode, groups]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 50) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const delta = -e.deltaY * 0.001;
      const newScale = Math.min(Math.max(0.25, transform.scale * (1 + delta)), 4);
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      setTransform({
        scale: newScale,
        x: mouseX - (mouseX - transform.x) * (newScale / transform.scale),
        y: mouseY - (mouseY - transform.y) * (newScale / transform.scale),
      });
    } else {
      setTransform(prev => ({ ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    }
  }, [transform]);

  const fitScreen = useCallback(() => setTransform({ x: 60, y: 60, scale: 1 }), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') fitScreen();
      if (e.key === 'Escape') {
        setFocusMode(false); setFocusedId(null); setSelectedIds(new Set());
        setShowStickyForm(false); setRenamingGroupId(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fitScreen]);

  // ── Edit mode ───────────────────────────────────────────────────────────────
  const toggleEditMode = async () => {
    if (editMode && boardDirty) {
      try {
        await savePinboard.mutateAsync({ workspace: 'WR', data: { cards, connections } });
        setBoardDirty(false);
        toast({ title: 'Board saved' });
      } catch (err: any) {
        toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
      }
    }
    setSelectedIds(new Set());
    setEditMode(prev => !prev);
  };

  // ── Add sticky note ─────────────────────────────────────────────────────────
  const addSticky = () => {
    if (!stickyText.trim()) return;
    const vcx = (-transform.x + (containerRef.current?.clientWidth ?? 600) / 2) / transform.scale;
    const vcy = (-transform.y + (containerRef.current?.clientHeight ?? 400) / 2) / transform.scale;
    const jitter = () => (Math.random() - 0.5) * 60;
    setCards(prev => [...prev, {
      id: `sticky-${Date.now()}`,
      type: 'stickyNote', postId: null,
      title: 'Sticky', authorName: null, status: null, category: null, tags: [],
      noteText: stickyText.trim(),
      x: vcx - CARD_W_STICKY / 2 + jitter(),
      y: vcy - CARD_H_STICKY / 2 + jitter(),
      groupId: null,
    } as PinCard]);
    setBoardDirty(true);
    setStickyText(''); setShowStickyForm(false);
  };

  // ── Group creation ──────────────────────────────────────────────────────────
  const createGroup = () => {
    if (selectedIds.size < 2) return;
    const gId = `G-${Date.now()}`;
    const selectedArr = cards.filter(c => selectedIds.has(c.id));
    const newConns: PinConnection[] = [];
    for (let i = 0; i < selectedArr.length - 1; i++) {
      const exists = connections.some(cn =>
        (cn.from === selectedArr[i].id && cn.to === selectedArr[i + 1].id) ||
        (cn.from === selectedArr[i + 1].id && cn.to === selectedArr[i].id)
      );
      if (!exists) newConns.push({ from: selectedArr[i].id, to: selectedArr[i + 1].id });
    }
    setGroups(prev => ({ ...prev, [gId]: groupName || 'Group' }));
    setCards(prev => prev.map(c => selectedIds.has(c.id) ? { ...c, groupId: gId } : c));
    setConnections(prev => [...prev, ...newConns]);
    setBoardDirty(true);
    setGroupName(''); setSelectedIds(new Set());
  };

  const unlinkGroup = () => {
    setCards(prev => prev.map(c => selectedIds.has(c.id) ? { ...c, groupId: null } : c));
    setConnections(prev => prev.filter(cn => {
      const f = cards.find(c => c.id === cn.from);
      const t = cards.find(c => c.id === cn.to);
      return !(f && selectedIds.has(f.id) && t && selectedIds.has(t.id));
    }));
    setBoardDirty(true); setSelectedIds(new Set());
  };

  const commitRename = () => {
    if (renamingGroupId && renameValue.trim()) {
      setGroups(prev => ({ ...prev, [renamingGroupId]: renameValue.trim() }));
    }
    setRenamingGroupId(null);
  };

  const focusedCard = focusedId ? cards.find(c => c.id === focusedId) : null;

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative" ref={containerRef}>
      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-10 flex gap-2 items-center">
        <Button variant={editMode ? 'default' : 'secondary'} size="sm" className="h-7 text-xs shadow-md" onClick={toggleEditMode}>
          {editMode
            ? <><Check className="w-3.5 h-3.5 mr-1.5" />{boardDirty ? 'Save & Exit' : 'Done'}</>
            : <><Edit3 className="w-3.5 h-3.5 mr-1.5" />Edit</>
          }
        </Button>
        {editMode && (
          <Button variant="secondary" size="sm" className="h-7 text-xs shadow-md" onClick={() => setShowStickyForm(p => !p)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />Sticky
          </Button>
        )}
        {boardDirty && !editMode && (
          <span className="text-[9px] text-muted-foreground/50 italic">saving…</span>
        )}
      </div>

      <div className="absolute top-3 right-3 z-10">
        <Button variant="secondary" size="icon" className="h-7 w-7 shadow-md" onClick={fitScreen} title="Fit (F)">
          <Maximize className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Sticky note form */}
      {showStickyForm && (
        <div className="absolute top-12 left-3 z-20 bg-surface border border-border/60 rounded-lg shadow-xl p-3 w-60">
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-2">New Sticky Note</p>
          <textarea
            autoFocus
            value={stickyText}
            onChange={e => setStickyText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addSticky(); }
              if (e.key === 'Escape') { setShowStickyForm(false); setStickyText(''); }
            }}
            placeholder="Type a note…"
            className="w-full bg-background border border-border/40 text-xs text-foreground placeholder:text-muted-foreground/30 rounded p-2 resize-none min-h-[72px] outline-none"
          />
          <div className="flex gap-1.5 mt-2">
            <Button size="sm" className="h-7 text-xs flex-1" onClick={addSticky} disabled={!stickyText.trim()}>Add</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setShowStickyForm(false); setStickyText(''); }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Group rename input */}
      {renamingGroupId && (() => {
        const members = cards.filter(c => c.groupId === renamingGroupId);
        if (!members.length) return null;
        const b = groupBounds(members);
        const screenX = b.x * transform.scale + transform.x;
        const screenY = (b.y - 22) * transform.scale + transform.y;
        return (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setRenamingGroupId(null);
            }}
            onBlur={commitRename}
            className="absolute z-30 bg-surface/90 border border-primary/50 text-[10px] uppercase tracking-widest font-semibold text-foreground px-2 py-1 rounded outline-none backdrop-blur min-w-[80px]"
            style={{ left: Math.max(4, screenX), top: Math.max(4, screenY) }}
          />
        );
      })()}

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

      {/* Focused card context bar */}
      {focusedCard && !editMode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-surface/90 backdrop-blur border border-border/50 rounded-lg px-4 py-3 shadow-xl flex items-center gap-3 max-w-sm w-[calc(100%-2rem)]">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={cn(
                "text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm font-semibold",
                focusedCard.type === 'stickyNote' ? "bg-amber-900/30 text-amber-400" : "border border-border/40 text-muted-foreground"
              )}>
                {focusedCard.type === 'stickyNote' ? 'Note' : 'Post'}
              </span>
              {focusedCard.status && (
                <span className="text-[9px] font-semibold" style={{ color: statusColor(focusedCard.status) }}>
                  {focusedCard.status}
                </span>
              )}
            </div>
            <p className="text-xs font-semibold truncate">{focusedCard.title || focusedCard.noteText}</p>
            {focusedCard.authorName && <p className="text-[10px] text-muted-foreground">{focusedCard.authorName}</p>}
          </div>
          <Button variant={focusMode ? 'default' : 'secondary'} size="sm" className="h-7 text-xs shrink-0" onClick={() => setFocusMode(p => !p)}>
            {focusMode ? 'Exit Focus' : 'Focus'}
          </Button>
          <button onClick={() => { setFocusedId(null); setFocusMode(false); }} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Group action bar */}
      {editMode && selectedIds.size >= 2 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-surface/90 backdrop-blur border border-border/50 rounded-lg px-3 py-2.5 shadow-xl flex items-center gap-2 max-w-sm w-[calc(100%-2rem)]">
          <span className="text-[10px] text-muted-foreground shrink-0">{selectedIds.size} selected</span>
          <Input
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            placeholder="Group name…"
            className="h-7 text-xs bg-background border-border/40 flex-1"
            onKeyDown={e => { if (e.key === 'Enter') createGroup(); }}
          />
          <Button size="sm" className="h-7 text-xs shrink-0" onClick={createGroup}>Group</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs border-border/40 shrink-0" onClick={unlinkGroup}>Unlink</Button>
          <button onClick={() => setSelectedIds(new Set())} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
