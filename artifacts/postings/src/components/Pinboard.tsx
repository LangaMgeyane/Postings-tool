import React, {
  useEffect, useRef, useState, useCallback
} from 'react';
import { useGetPinboard, useSavePinboard, useListAnnotations, getListAnnotationsQueryKey } from '@workspace/api-client-react';
import { PinCard, PinConnection } from '@workspace/api-client-react';
import { getSession, setSession } from '@/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Maximize, Edit3, X, Loader2, Check, Filter, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';

interface Transform { x: number; y: number; scale: number }

const CARD_W_POST = 200;
const CARD_H_POST = 100;
const CARD_W_NODE = 120;
const CARD_H_NODE = 68;
const GROUP_PADDING = 28;

function cardDims(c: PinCard) {
  if (c.type === 'annotationNode') return { w: CARD_W_NODE, h: CARD_H_NODE };
  return { w: CARD_W_POST, h: CARD_H_POST };
}
function cardX(c: PinCard) { return c.x ?? 0; }
function cardY(c: PinCard) { return c.y ?? 0; }

function statusColor(s: string | null) {
  if (s === 'publish') return '#22c55e';
  if (s === 'in-review') return '#f59e0b';
  return '#64748b';
}

function annotationTypeColor(t: string | null) {
  if (t === 'drawing') return '#818cf8';
  if (t === 'text') return '#E55A1B';
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

function getEdgeHandles(card: PinCard) {
  const { w, h } = cardDims(card);
  const x = cardX(card), y = cardY(card);
  return [
    { x: x + w / 2, y: y,         side: 'top' },
    { x: x + w,     y: y + h / 2, side: 'right' },
    { x: x + w / 2, y: y + h,     side: 'bottom' },
    { x: x,         y: y + h / 2, side: 'left' },
  ];
}

function hitEdgeHandle(pos: { x: number; y: number }, cardList: PinCard[]) {
  const HIT_R = 14;
  for (const card of cardList) {
    for (const handle of getEdgeHandles(card)) {
      const dx = pos.x - handle.x, dy = pos.y - handle.y;
      if (Math.sqrt(dx * dx + dy * dy) < HIT_R) return { card, handle };
    }
  }
  return null;
}

function connectionMidpoint(from: PinCard, to: PinCard) {
  const { w: fw, h: fh } = cardDims(from);
  const { w: tw, h: th } = cardDims(to);
  return {
    x: (cardX(from) + fw / 2 + cardX(to) + tw / 2) / 2,
    y: (cardY(from) + fh / 2 + cardY(to) + th / 2) / 2,
  };
}

function hitConnectionMidpoint(pos: { x: number; y: number }, cardList: PinCard[], conns: PinConnection[]) {
  const HIT_R = 16;
  for (let i = 0; i < conns.length; i++) {
    if ((conns[i] as any).system) continue;
    const from = cardList.find(c => c.id === conns[i].from);
    const to = cardList.find(c => c.id === conns[i].to);
    if (!from || !to) continue;
    const mid = connectionMidpoint(from, to);
    const dx = pos.x - mid.x, dy = pos.y - mid.y;
    if (Math.sqrt(dx * dx + dy * dy) < HIT_R) return i;
  }
  return -1;
}

// ────────────────────────────────────────────────────────────────────

interface ExpandNodeData {
  card: PinCard;
}

export function Pinboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const session = getSession();
  const [, setLocation] = useLocation();

  const [cards, setCards] = useState<PinCard[]>([]);
  const [connections, setConnections] = useState<PinConnection[]>([]);
  const [groups, setGroups] = useState<Record<string, string>>({});
  const [transform, setTransform] = useState<Transform>({ x: 60, y: 60, scale: 1 });
  const [loaded, setLoaded] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [boardDirty, setBoardDirty] = useState(false);
  const [groupName, setGroupName] = useState('');

  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [filterOpen, setFilterOpen] = useState(false);
  const [expandNode, setExpandNode] = useState<ExpandNodeData | null>(null);

  // Filter state
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set(['in-review', 'publish']));
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set(['post', 'annotationNode']));

  // Snapshot for cancel edit mode
  const editSnapshotRef = useRef<{ cards: PinCard[]; connections: PinConnection[] } | null>(null);

  // Selected connection index (for deletion)
  const [selectedConnIdx, setSelectedConnIdx] = useState<number | null>(null);

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
    setTransform({
      x: cw / 2 - (cardX(card) + w / 2),
      y: ch / 2 - (cardY(card) + h / 2),
      scale: 1,
    });
    setFocusedId(card.id);
  }, [loaded, session?.selectedPostId]);

  // Autosave debounced
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

  // ── Drag state refs ────────────────────────────────────────────────────────
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

  // Link creation drag state
  const linkDragRef = useRef({
    active: false,
    fromCard: null as PinCard | null,
    fromX: 0, fromY: 0,
    toX: 0, toY: 0,
  });

  const [hoverCardId, setHoverCardId] = useState<string | null>(null);

  // ── Canvas helpers ─────────────────────────────────────────────────────────
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

  const hitGroupLabel = useCallback((px: number, py: number, cardList: PinCard[], groupMap: Record<string, string>) => {
    const groupIds = [...new Set(cardList.map(c => c.groupId).filter(Boolean) as string[])];
    for (const gId of groupIds) {
      const members = cardList.filter(c => c.groupId === gId);
      if (members.length === 0) continue;
      const bounds = groupBounds(members);
      const labelY = bounds.y - 4;
      const labelX = bounds.x + 12;
      const name = groupMap[gId] || 'Group';
      if (px >= labelX && px <= labelX + name.length * 7 + 10 && py >= labelY - 14 && py <= labelY + 2) {
        return gId;
      }
    }
    return null;
  }, []);

  // ── Draw ───────────────────────────────────────────────────────────────────
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

    const cw = canvas.width / dpr, ch = canvas.height / dpr;

    // Dot grid
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

    // ── Group bounding containers ───────────────────────────────────────
    const groupIds = [...new Set(cards.map(c => c.groupId).filter(Boolean) as string[])];
    groupIds.forEach(gId => {
      const members = cards.filter(c => c.groupId === gId);
      if (members.length === 0) return;
      const b = groupBounds(members);
      const name = groups[gId] || 'Group';

      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.02)';
      ctx.strokeStyle = renamingGroupId === gId ? 'rgba(229,90,27,0.4)' : 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1 / transform.scale;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = renamingGroupId === gId ? 'rgba(229,90,27,0.8)' : 'rgba(255,255,255,0.22)';
      ctx.font = `600 11px "DM Sans", sans-serif`;
      ctx.fillText(name.toUpperCase(), b.x + 12, b.y - 6);
      ctx.restore();
    });

    // ── Connections ─────────────────────────────────────────────────────
    connections.forEach((conn, idx) => {
      const from = cards.find(c => c.id === conn.from);
      const to = cards.find(c => c.id === conn.to);
      if (!from || !to) return;
      const { w: fw, h: fh } = cardDims(from);
      const { w: tw, h: th } = cardDims(to);
      const fx = cardX(from) + fw / 2, fy = cardY(from) + fh / 2;
      const tx2 = cardX(to) + tw / 2, ty2 = cardY(to) + th / 2;

      const isSystem = (conn as any).system === true;
      const isSelected = selectedConnIdx === idx;

      ctx.save();
      if (isSystem) {
        ctx.strokeStyle = 'rgba(129,140,248,0.25)';
        ctx.lineWidth = 1 / transform.scale;
        ctx.setLineDash([4 / transform.scale, 4 / transform.scale]);
      } else if (isSelected) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2 / transform.scale;
        ctx.shadowColor = '#3b82f640';
        ctx.shadowBlur = 8;
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1.5 / transform.scale;
      }

      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.bezierCurveTo(fx + (tx2 - fx) * 0.5, fy, fx + (tx2 - fx) * 0.5, ty2, tx2, ty2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Delete hint on selected connection
      if (isSelected && !isSystem) {
        const mid = connectionMidpoint(from, to);
        ctx.save();
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(mid.x, mid.y, 6 / transform.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.round(8 / transform.scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('×', mid.x, mid.y);
        ctx.restore();
      }
    });

    // ── Cards ────────────────────────────────────────────────────────────
    cards.forEach(card => {
      const { w, h } = cardDims(card);
      const kx = cardX(card), ky = cardY(card);
      const isSelected = selectedIds.has(card.id);
      const isFocused = focusedId === card.id;
      
      // Apply filter logic: check if card matches active filters
      const matchesType = typeFilters.has(card.type);
      const matchesStatus = card.type === 'annotationNode' || statusFilters.has(card.status ?? '');
      const filteredOut = !matchesType || !matchesStatus;
      
      const dimmed = (focusMode && !isFocused && !isSelected) || filteredOut;
      const isHovered = hoverCardId === card.id;

      ctx.save();
      ctx.globalAlpha = dimmed ? 0.2 : 1;

      if (card.type === 'post') {
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#181818';
        ctx.fillRect(kx, ky, w, h);
        ctx.shadowBlur = 0;

        const sc = statusColor(card.status ?? null);
        ctx.fillStyle = sc;
        ctx.fillRect(kx, ky, 5, h);

        ctx.fillStyle = '#e2e0da';
        ctx.font = `600 13px "DM Sans", sans-serif`;
        wrapText(ctx, card.title || 'Untitled', kx + 14, ky + 22, w - 22, 16, 2);

        ctx.fillStyle = '#555';
        ctx.font = `11px "DM Sans", sans-serif`;
        ctx.fillText(card.authorName || '', kx + 14, ky + 58);

        ctx.fillStyle = sc;
        ctx.beginPath();
        ctx.arc(kx + 14 + (ctx.measureText(card.authorName || '').width) + 8, ky + 54, 3, 0, Math.PI * 2);
        ctx.fill();

        if (card.category) {
          ctx.fillStyle = '#3a3a3a';
          ctx.font = `10px "DM Sans", sans-serif`;
          ctx.fillText(card.category.toUpperCase(), kx + 14, ky + 76);
        }

      } else if (card.type === 'annotationNode') {
        // Annotation node card — small, dark, thumbnail style
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#111118';
        ctx.beginPath();
        ctx.roundRect(kx, ky, w, h, 4);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Top accent line based on annotation type
        const ac = annotationTypeColor(card.annotationType ?? null);
        ctx.fillStyle = ac;
        ctx.fillRect(kx, ky, w, 3);

        // Type label
        ctx.fillStyle = ac + '99';
        ctx.font = `bold 9px "DM Sans", sans-serif`;
        ctx.fillText((card.annotationType || 'note').toUpperCase(), kx + 8, ky + 16);

        // Author
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = `10px "DM Sans", sans-serif`;
        ctx.fillText(`@${card.authorName || ''}`, kx + 8, ky + 30);

        // Preview text
        if (card.annotationPreview || card.noteText) {
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.font = `10px "DM Sans", sans-serif`;
          wrapText(ctx, card.annotationPreview || card.noteText || '', kx + 8, ky + 45, w - 16, 13, 2);
        }
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

      // Edge handles in edit mode (for hovered card)
      if (editMode && isHovered) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 1 / transform.scale;
        for (const handle of getEdgeHandles(card)) {
          ctx.beginPath();
          ctx.arc(handle.x, handle.y, 5 / transform.scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      ctx.restore();
    });

    // ── Link drag preview ────────────────────────────────────────────────
    if (linkDragRef.current.active) {
      const { fromX, fromY, toX, toY } = linkDragRef.current;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5 / transform.scale;
      ctx.setLineDash([5 / transform.scale, 3 / transform.scale]);
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    ctx.restore();
  }, [cards, connections, groups, transform, selectedIds, focusedId, focusMode, editMode, renamingGroupId, hoverCardId, selectedConnIdx, statusFilters, typeFilters]);

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

  // ── Pointer events ─────────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = toCanvas(e.clientX, e.clientY);

    dragRef.current.mouseDownPos = { x: e.clientX, y: e.clientY };
    dragRef.current.moved = false;

    if (editMode) {
      // Check edge handle → start link drag
      const handleHit = hitEdgeHandle(pos, cards);
      if (handleHit) {
        linkDragRef.current = {
          active: true,
          fromCard: handleHit.card,
          fromX: handleHit.handle.x,
          fromY: handleHit.handle.y,
          toX: handleHit.handle.x,
          toY: handleHit.handle.y,
        };
        return;
      }

      // Check connection midpoint → select connection
      const connIdx = hitConnectionMidpoint(pos, cards, connections);
      if (connIdx >= 0) {
        setSelectedConnIdx(prev => prev === connIdx ? null : connIdx);
        return;
      }

      // Check card → drag
      const hit = hitTest(pos.x, pos.y, cards);
      if (hit) {
        dragRef.current.target = hit;
        dragRef.current.cardStartX = hit.x ?? 0;
        dragRef.current.cardStartY = hit.y ?? 0;
        dragRef.current.startX = e.clientX;
        dragRef.current.startY = e.clientY;
        dragRef.current.panning = false;
        setSelectedConnIdx(null);
        return;
      }
      // Else pan
      dragRef.current.panning = true;
      dragRef.current.panStart = { x: e.clientX, y: e.clientY };
      dragRef.current.transformStart = { x: transform.x, y: transform.y };
      setSelectedConnIdx(null);
    } else {
      dragRef.current.panning = true;
      dragRef.current.panStart = { x: e.clientX, y: e.clientY };
      dragRef.current.transformStart = { x: transform.x, y: transform.y };
    }
  }, [toCanvas, hitTest, cards, connections, editMode, transform]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const dx = e.clientX - dragRef.current.mouseDownPos.x;
    const dy = e.clientY - dragRef.current.mouseDownPos.y;
    if (Math.sqrt(dx * dx + dy * dy) > 3) dragRef.current.moved = true;

    const pos = toCanvas(e.clientX, e.clientY);

    // Update hover for edge handles
    if (editMode) {
      const hit = hitTest(pos.x, pos.y, cards);
      setHoverCardId(hit?.id ?? null);
    }

    if (linkDragRef.current.active) {
      linkDragRef.current.toX = pos.x;
      linkDragRef.current.toY = pos.y;
      draw();
      return;
    }

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
  }, [editMode, transform.scale, toCanvas, hitTest, cards, draw]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    const wasDragging = dragRef.current.moved;
    const pos = toCanvas(e.clientX, e.clientY);

    // Finish link drag
    if (linkDragRef.current.active) {
      linkDragRef.current.active = false;
      const target = hitTest(pos.x, pos.y, cards);
      const from = linkDragRef.current.fromCard;
      if (target && from && target.id !== from.id) {
        const alreadyExists = connections.some(c =>
          (c.from === from.id && c.to === target.id) ||
          (c.from === target.id && c.to === from.id)
        );
        if (!alreadyExists) {
          setConnections(prev => [...prev, { from: from.id, to: target.id, system: false } as any]);
          setBoardDirty(true);
        }
      }
      draw();
      return;
    }

    dragRef.current.target = null;
    dragRef.current.panning = false;

    if (!wasDragging) {
      const hit = hitTest(pos.x, pos.y, cards);

      // Double-tap on group label → rename
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
          // Annotation node → open expand modal
          if (hit.type === 'annotationNode') {
            setExpandNode({ card: hit });
          } else {
            setFocusedId(hit.id);
          }
        } else if (!gLabelHit) {
          setFocusedId(null);
          setFocusMode(false);
        }
      }
    }
  }, [toCanvas, hitTest, hitGroupLabel, cards, connections, editMode, groups, draw]);

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

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') fitScreen();
      if (e.key === 'Escape') {
        setFocusMode(false); setFocusedId(null); setSelectedIds(new Set());
        setRenamingGroupId(null); setSelectedConnIdx(null);
      }
      // Delete selected connection
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedConnIdx !== null) {
        const conn = connections[selectedConnIdx];
        if (conn && !(conn as any).system) {
          setConnections(prev => prev.filter((_, i) => i !== selectedConnIdx));
          setSelectedConnIdx(null);
          setBoardDirty(true);
        }
      }
      // Delete selected cards in edit mode
      if ((e.key === 'Delete' || e.key === 'Backspace') && editMode && selectedIds.size > 0) {
        const ids = selectedIds;
        setCards(prev => prev.filter(c => !ids.has(c.id)));
        setConnections(prev => prev.filter(cn => !ids.has(cn.from) && !ids.has(cn.to)));
        setSelectedIds(new Set());
        setBoardDirty(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fitScreen, selectedConnIdx, connections, editMode, selectedIds]);

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
    // Capture snapshot when entering edit mode
    if (!editMode) {
      editSnapshotRef.current = {
        cards: JSON.parse(JSON.stringify(cards)),
        connections: JSON.parse(JSON.stringify(connections)),
      };
    } else {
      editSnapshotRef.current = null;
    }
    setSelectedIds(new Set());
    setHoverCardId(null);
    setSelectedConnIdx(null);
    setEditMode(prev => !prev);
  };

  const cancelEditMode = () => {
    // Restore from snapshot
    if (editSnapshotRef.current) {
      setCards(editSnapshotRef.current.cards);
      setConnections(editSnapshotRef.current.connections);
      editSnapshotRef.current = null;
    }
    setBoardDirty(false);
    setSelectedIds(new Set());
    setHoverCardId(null);
    setSelectedConnIdx(null);
    setEditMode(false);
    toast({ title: 'Changes discarded' });
  };

  // ── Group creation (no connections) ────────────────────────────────────────
  const createGroup = () => {
    if (selectedIds.size < 2) return;
    const gId = `G-${Date.now()}`;
    setGroups(prev => ({ ...prev, [gId]: groupName || 'Group' }));
    setCards(prev => prev.map(c => selectedIds.has(c.id) ? { ...c, groupId: gId } : c));
    setBoardDirty(true);
    setGroupName(''); setSelectedIds(new Set());
  };

  const ungroup = () => {
    setCards(prev => prev.map(c => selectedIds.has(c.id) ? { ...c, groupId: null } : c));
    setBoardDirty(true); setSelectedIds(new Set());
  };

  const commitRename = () => {
    if (renamingGroupId && renameValue.trim()) {
      setGroups(prev => ({ ...prev, [renamingGroupId]: renameValue.trim() }));
    }
    setRenamingGroupId(null);
  };

  const focusedCard = focusedId ? cards.find(c => c.id === focusedId) : null;

  // Open a post in the correct journal based on authorship
  const handleOpenPost = (card: PinCard) => {
    if (!card.postId || !session) return;
    const isAuthor = card.authorName === session.userName;
    const subspace = isAuthor ? 'c2' : 'c1'; // c2 = My Journal, c1 = Main Journal
    const pageRole = isAuthor ? 'author' : 'member';
    setSession({
      selectedPostId: card.postId,
      currentSubspace: subspace,
      isAuthorOfSelected: isAuthor,
      pageRole,
    });
    setLocation(`/writers-room?subspace=${subspace}`);
  };

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
          <>
            <Button variant="outline" size="sm" className="h-7 text-xs border-border/40" onClick={cancelEditMode}>
              <X className="w-3.5 h-3.5 mr-1.5" />Cancel
            </Button>
            <div className="text-[9px] text-muted-foreground/40 italic flex items-center gap-1">
              <LinkIcon className="w-3 h-3" />
              <span>Drag from card edge to link</span>
            </div>
          </>
        )}
        {boardDirty && !editMode && (
          <span className="text-[9px] text-muted-foreground/50 italic">saving…</span>
        )}
      </div>

      <div className="absolute top-3 right-3 z-10 flex gap-2 items-center">
        <Button
          variant={filterOpen ? 'default' : 'secondary'}
          size="icon"
          className="h-7 w-7 shadow-md"
          onClick={() => setFilterOpen(p => !p)}
          title="Filters"
        >
          <Filter className="w-3.5 h-3.5" />
        </Button>
        <Button variant="secondary" size="icon" className="h-7 w-7 shadow-md" onClick={fitScreen} title="Fit (F)">
          <Maximize className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Filter panel */}
      {filterOpen && (
        <div className="absolute top-12 right-3 z-20 bg-surface border border-border/60 rounded-lg shadow-xl p-4 w-56">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">Filters</p>
            <button onClick={() => setFilterOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">Status</p>
              <div className="space-y-1">
                {['in-review', 'publish'].map(s => (
                  <label key={s} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={statusFilters.has(s)}
                      onChange={(e) => {
                        setStatusFilters(prev => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(s);
                          else next.delete(s);
                          return next;
                        });
                      }}
                      className="accent-primary rounded"
                    />
                    <span className="text-xs text-foreground/70 capitalize group-hover:text-foreground transition-colors">
                      {s === 'in-review' ? 'In Review' : 'Published'}
                    </span>
                    <span className="ml-auto w-2 h-2 rounded-full" style={{ background: statusColor(s) }} />
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">Type</p>
              <div className="space-y-1">
                {[['post', 'Post pins'], ['annotationNode', 'Annotation nodes']].map(([type, label]) => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={typeFilters.has(type)}
                      onChange={(e) => {
                        setTypeFilters(prev => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(type);
                          else next.delete(type);
                          return next;
                        });
                      }}
                      className="accent-primary rounded"
                    />
                    <span className="text-xs text-foreground/70 group-hover:text-foreground transition-colors">{label}</span>
                  </label>
                ))}
              </div>
            </div>
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
        style={{ cursor: linkDragRef.current.active ? 'crosshair' : editMode ? 'default' : 'grab', touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      />

      {/* Focused post card context bar */}
      {focusedCard && focusedCard.type === 'post' && !editMode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-surface/90 backdrop-blur border border-border/50 rounded-lg px-4 py-3 shadow-xl flex items-center gap-3 max-w-sm w-[calc(100%-2rem)]">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm font-semibold border border-border/40 text-muted-foreground">Post</span>
              {focusedCard.status && (
                <span className="text-[9px] font-semibold" style={{ color: statusColor(focusedCard.status) }}>
                  {focusedCard.status}
                </span>
              )}
            </div>
            <p className="text-xs font-semibold truncate">{focusedCard.title}</p>
            {focusedCard.authorName && <p className="text-[10px] text-muted-foreground">{focusedCard.authorName}</p>}
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 text-xs shrink-0"
            onClick={() => handleOpenPost(focusedCard)}
          >
            <ExternalLink className="w-3 h-3 mr-1.5" />Open
          </Button>
          <Button variant={focusMode ? 'default' : 'secondary'} size="sm" className="h-7 text-xs shrink-0" onClick={() => setFocusMode(p => !p)}>
            {focusMode ? 'Exit Focus' : 'Focus'}
          </Button>
          <button onClick={() => { setFocusedId(null); setFocusMode(false); }} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Connection delete hint */}
      {selectedConnIdx !== null && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-surface/90 backdrop-blur border border-border/50 rounded-lg px-4 py-2 shadow-xl flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Link selected</span>
          <Button
            variant="destructive"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setConnections(prev => prev.filter((_, i) => i !== selectedConnIdx));
              setSelectedConnIdx(null);
              setBoardDirty(true);
            }}
          >
            Delete Link
          </Button>
          <button onClick={() => setSelectedConnIdx(null)} className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
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
          <Button variant="outline" size="sm" className="h-7 text-xs border-border/40 shrink-0" onClick={ungroup}>Ungroup</Button>
          <button onClick={() => setSelectedIds(new Set())} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Annotation node expand modal */}
      {expandNode && (
        <AnnotationNodeModal card={expandNode.card} onClose={() => setExpandNode(null)} />
      )}
    </div>
  );
}

// ── Annotation Node Expand Modal ──────────────────────────────────────────────

function AnnotationNodeModal({ card, onClose }: { card: PinCard; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data: annotations } = useListAnnotations(card.postId || '', {
    query: {
      enabled: !!card.postId && card.annotationId !== null,
      queryKey: [...getListAnnotationsQueryKey(card.postId || ''), 'expand'],
    }
  });

  const ann = annotations?.find(a => a.id === card.annotationId);

  // Draw strokes if drawing annotation
  useEffect(() => {
    if (!ann || ann.type !== 'drawing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    if ((ann as any).imageData) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, w, h);
        drawStrokes();
      };
      img.src = (ann as any).imageData;
    } else {
      drawStrokes();
    }
    function drawStrokes() {
      if (!ctx) return;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.shadowBlur = 6;
      ctx.shadowColor = 'rgba(255,255,255,0.5)';
      (ann!.strokes || []).forEach((s: any) => {
        const pts = s.points || [];
        if (pts.length < 2) return;
        ctx.beginPath();
        ctx.moveTo((pts[0].x || 0) * w, (pts[0].y || 0) * h);
        for (let i = 1; i < pts.length; i++) ctx.lineTo((pts[i].x || 0) * w, (pts[i].y || 0) * h);
        ctx.stroke();
      });
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#E55A1B';
      ctx.font = '14px "DM Sans", sans-serif';
      (ann!.texts || []).forEach((t: any) => {
        ctx.fillText(t.text || '', (t.x || 0) * w, (t.y || 0) * h);
      });
    }
  }, [ann]);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-surface border border-border/60 rounded-xl shadow-2xl p-4 max-w-md w-[calc(100%-2rem)] mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <span
              className="text-[9px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded"
              style={{
                background: `${annotationTypeColor(card.annotationType ?? null)}20`,
                color: annotationTypeColor(card.annotationType ?? null),
              }}
            >
              {card.annotationType || 'annotation'}
            </span>
            <p className="text-[10px] text-muted-foreground mt-1">
              @{card.authorName}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {ann?.type === 'drawing' && (
          <div className="rounded overflow-hidden border border-border/30 bg-black/40" style={{ height: 200 }}>
            <canvas ref={canvasRef} width={400} height={200} className="w-full h-full" />
          </div>
        )}

        {(ann?.type === 'text' || !ann?.strokes?.length) && (
          <div className="bg-background/50 rounded p-3 border border-border/30">
            <p className="text-sm text-foreground/80 leading-relaxed">
              {ann?.texts?.map((t: any) => t.text).join(' ') || ann?.text || card.annotationPreview || '(No preview)'}
            </p>
          </div>
        )}

        {!ann && (
          <div className="bg-background/50 rounded p-3 border border-border/30">
            <p className="text-xs text-muted-foreground/60 italic">{card.annotationPreview || card.noteText || '(Annotation preview)'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
