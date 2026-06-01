import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  useListAnnotations,
  useListComments,
  useDeleteAnnotation,
  useDeleteComment,
  useCreateComment,
  useGetPinboard,
  getListAnnotationsQueryKey,
  getListCommentsQueryKey
} from '@workspace/api-client-react';
import { Annotation, PinCard } from '@workspace/api-client-react';
import { getSession } from '@/session';
import { formatDistanceToNow } from 'date-fns';
import { X, PenTool, Type, MessageSquare, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';

interface ANBPanelProps {
  onClose?: () => void;
}

export function ANBPanel({ onClose }: ANBPanelProps) {
  const session = getSession();
  const [activeTab, setActiveTab] = useState<'notes' | 'comments' | 'board'>('notes');
  const postId = session?.selectedPostId;

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="flex h-11 border-b border-border/40 shrink-0">
        {(['notes', 'comments', 'board'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 text-[9px] font-semibold uppercase tracking-widest transition-colors',
              activeTab === tab ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab}
          </button>
        ))}
        {onClose && (
          <button onClick={onClose} className="px-3 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'notes' && <NotesTab postId={postId} />}
        {activeTab === 'comments' && <CommentsTab postId={postId} />}
        {activeTab === 'board' && <BoardTab postId={postId} />}
      </div>
    </div>
  );
}

// ── Notes tab ──────────────────────────────────────────────────────────────────

function NotesTab({ postId }: { postId?: string }) {
  const session = getSession();
  const queryClient = useQueryClient();
  const deleteAnnotation = useDeleteAnnotation();
  const { toast } = useToast();
  const [previewAnn, setPreviewAnn] = useState<Annotation | null>(null);

  const { data: annotations, isLoading } = useListAnnotations(postId || '', {
    query: { enabled: !!postId, queryKey: getListAnnotationsQueryKey(postId || '') }
  });

  const handleDelete = async (id: string) => {
    if (!postId) return;
    try {
      await deleteAnnotation.mutateAsync({ postId, annId: id });
      queryClient.invalidateQueries({ queryKey: getListAnnotationsQueryKey(postId) });
    } catch (e: any) {
      toast({ title: 'Failed to delete', description: e.message, variant: 'destructive' });
    }
  };

  if (!postId) return <EmptyState message="Select a post to view notes" />;
  if (isLoading) return <EmptyState message="Loading…" />;
  if (!annotations?.length) return <EmptyState message="No annotations yet" />;

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2 relative">
      {annotations.map(ann => (
        <div key={ann.id} className="relative group p-3 bg-surface/40 border border-border/30 rounded text-xs">
          <div className="flex items-start gap-2 mb-1.5">
            <button
              className="mt-0.5 text-primary/50 hover:text-primary transition-colors shrink-0 p-0.5 rounded min-w-[20px] min-h-[20px] flex items-center justify-center"
              onClick={() => setPreviewAnn(previewAnn?.id === ann.id ? null : ann)}
              title="Preview annotation"
            >
              {ann.type === 'drawing' ? <PenTool className="w-3 h-3" /> :
               ann.type === 'text' ? <Type className="w-3 h-3" /> :
               <MessageSquare className="w-3 h-3" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {ann.noteType && (
                  <span className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 bg-primary/10 text-primary rounded-sm">
                    {ann.noteType}
                  </span>
                )}
                <span className="font-semibold text-foreground/80">{ann.authorName}</span>
                <span className="text-[9px] text-muted-foreground/60">
                  {formatDistanceToNow(new Date(ann.createdAt))} ago
                </span>
              </div>
              <p className="text-muted-foreground leading-snug mt-1 line-clamp-3">
                {ann.texts?.[0]?.text ?? ann.text ?? '(drawing)'}
              </p>
            </div>
            {session?.userId === ann.authorId && (
              <button
                onClick={() => handleDelete(ann.id)}
                className="p-1 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {previewAnn?.id === ann.id && (
            <AnnotationPreview ann={ann} onClose={() => setPreviewAnn(null)} />
          )}
        </div>
      ))}
    </div>
  );
}

function AnnotationPreview({ ann, onClose }: { ann: Annotation; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ann.type !== 'drawing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const draw = () => {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'rgba(255,255,255,0.6)';
      (ann.strokes || []).forEach((s: any) => {
        const pts = s.points || [];
        if (pts.length < 2) return;
        ctx.beginPath();
        ctx.moveTo((pts[0].x ?? 0) * w, (pts[0].y ?? 0) * h);
        for (let i = 1; i < pts.length; i++) ctx.lineTo((pts[i].x ?? 0) * w, (pts[i].y ?? 0) * h);
        ctx.stroke();
      });
      ctx.shadowBlur = 0;
      (ann.texts || []).forEach((t: any) => {
        ctx.fillStyle = '#E55A1B';
        ctx.font = '12px "DM Sans", sans-serif';
        ctx.fillText(t.text || '', (t.x ?? 0) * w, (t.y ?? 0) * h);
      });
    };

    const imgData = (ann as any).imageData;
    if (imgData) {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0, w, h); draw(); };
      img.src = imgData;
    } else {
      draw();
    }
  }, [ann]);

  if (ann.type === 'note' || (ann.type === 'text' && !ann.strokes?.length)) {
    return (
      <div className="mt-2 p-2 bg-background/60 rounded border border-border/30 relative">
        <button onClick={onClose} className="absolute top-1 right-1 text-muted-foreground hover:text-foreground">
          <X className="w-3 h-3" />
        </button>
        <p className="text-xs text-muted-foreground pr-4">{ann.text}</p>
      </div>
    );
  }

  return (
    <div className="mt-2 relative rounded overflow-hidden border border-border/30" style={{ height: 80 }}>
      <button onClick={onClose} className="absolute top-1 right-1 z-10 text-white/60 hover:text-white bg-black/30 rounded p-0.5">
        <X className="w-3 h-3" />
      </button>
      <canvas ref={canvasRef} width={200} height={80} className="w-full h-full bg-black/40" />
    </div>
  );
}

// ── Comments tab ───────────────────────────────────────────────────────────────

function CommentsTab({ postId }: { postId?: string }) {
  const session = getSession();
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [charCount, setCharCount] = useState(0);
  const createComment = useCreateComment();
  const deleteComment = useDeleteComment();
  const { toast } = useToast();

  const { data: comments, isLoading } = useListComments(postId || '', {
    query: { enabled: !!postId, queryKey: getListCommentsQueryKey(postId || '') }
  });

  const handleSubmit = async () => {
    const text = textareaRef.current?.value?.trim();
    if (!text || !postId || !session) return;
    try {
      await createComment.mutateAsync({
        postId,
        data: { text, authorId: session.userId, authorName: session.userName } as any
      });
      if (textareaRef.current) { textareaRef.current.value = ''; setCharCount(0); }
      queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(postId) });
    } catch (e: any) {
      toast({ title: 'Failed to post', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!postId) return;
    try {
      await deleteComment.mutateAsync({ postId, commentId: id });
      queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(postId) });
    } catch (e: any) {
      toast({ title: 'Failed to delete', description: e.message, variant: 'destructive' });
    }
  };

  if (!postId) return <EmptyState message="Select a post to comment" />;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isLoading ? <EmptyState message="Loading…" /> :
         !comments?.length ? <EmptyState message="No comments yet" /> :
         comments.map(c => (
           <div key={c.id} className="relative group text-xs">
             <div className="flex items-center gap-1.5 mb-1">
               <span className="font-semibold text-foreground/85">{c.authorName}</span>
               <span className="text-[9px] text-muted-foreground/50">
                 {formatDistanceToNow(new Date(c.createdAt))} ago
               </span>
             </div>
             <p className="text-muted-foreground/80 leading-relaxed">{c.text}</p>
             {session?.userId === c.authorId && (
               <button onClick={() => handleDelete(c.id)} className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all">
                 <X className="w-3 h-3" />
               </button>
             )}
           </div>
         ))
        }
      </div>
      <div className="p-3 border-t border-border/40 shrink-0">
        <textarea
          ref={textareaRef}
          placeholder="Write a comment…"
          maxLength={500}
          onChange={e => setCharCount(e.target.value.length)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSubmit(); } }}
          className="w-full bg-background/50 border border-border/30 text-xs text-foreground placeholder:text-muted-foreground/30 rounded p-2 resize-none min-h-[56px] outline-none focus:border-border/60 transition-colors"
        />
        <div className="flex justify-between items-center mt-1.5">
          <span className={cn('text-[9px] transition-colors', charCount > 450 ? 'text-primary' : 'text-muted-foreground/40')}>
            {charCount}/500
          </span>
          <Button size="sm" onClick={handleSubmit} disabled={charCount === 0 || createComment.isPending} className="h-7 text-xs px-3">
            {createComment.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Post'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Board tab ──────────────────────────────────────────────────────────────────

function BoardTab({ postId }: { postId?: string }) {
  const [, setLocation] = useLocation();
  const { data: board } = useGetPinboard('WR');

  const currentCard = postId && board?.cards
    ? board.cards.find(c => c.type === 'post' && c.postId === postId) ?? null
    : null;

  // All cards in the same group, plus annotation nodes linked to current card
  const contextCards = currentCard && board?.cards
    ? board.cards.filter(c => {
        if (c.id === currentCard.id) return true;
        if (currentCard.groupId && c.groupId === currentCard.groupId) return true;
        // Include annotation nodes for this post
        if (c.type === 'annotationNode' && c.postId === postId) return true;
        // Include any cards linked to current card
        if (board.connections?.some(cn =>
          (cn.from === currentCard.id && cn.to === c.id) ||
          (cn.to === currentCard.id && cn.from === c.id)
        )) return true;
        return false;
      })
    : currentCard ? [currentCard] : [];

  const contextConns = board?.connections?.filter(cn =>
    contextCards.some(c => c.id === cn.from) && contextCards.some(c => c.id === cn.to)
  ) ?? [];

  if (!postId) {
    return (
      <div className="p-3 h-full flex flex-col">
        <EmptyState message="Select a post to see board context" />
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs border-border/40 text-muted-foreground hover:text-foreground mt-auto mx-3 mb-3"
          style={{ width: 'calc(100% - 1.5rem)' }}
          onClick={() => setLocation('/writers-room?subspace=c3')}
        >
          Open Board <ArrowRight className="w-3 h-3 ml-2" />
        </Button>
      </div>
    );
  }

  return (
    <div className="p-3 h-full flex flex-col gap-3">
      <div className="flex-1 bg-surface/30 border border-border/25 rounded overflow-hidden relative min-h-[120px]">
        {currentCard
          ? <BoardMiniCanvas cards={contextCards} connections={contextConns} focusedCard={currentCard} />
          : <EmptyState message="This post has no pin on the board yet" />
        }
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full h-8 text-xs border-border/40 text-muted-foreground hover:text-foreground shrink-0"
        onClick={() => setLocation('/writers-room?subspace=c3')}
      >
        {currentCard ? 'Open Board' : 'Open Board'}
        <ArrowRight className="w-3 h-3 ml-2" />
      </Button>
    </div>
  );
}

function BoardMiniCanvas({ cards, connections, focusedCard }: {
  cards: PinCard[];
  connections: { from: string; to: string; system?: boolean }[];
  focusedCard: PinCard;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cw, ch);

    if (cards.length === 0) return;

    const CARD_W = 150, CARD_H = 75;
    const NODE_W = 90, NODE_H = 52;

    function cdims(c: PinCard) { return c.type === 'annotationNode' ? { w: NODE_W, h: NODE_H } : { w: CARD_W, h: CARD_H }; }
    function scX(c: PinCard) { return c.x ?? 0; }
    function scY(c: PinCard) { return c.y ?? 0; }

    function statusColor2(s: string | null) {
      if (s === 'publish') return '#22c55e';
      if (s === 'in-review') return '#f59e0b';
      return '#64748b';
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    cards.forEach(c => {
      const { w, h } = cdims(c);
      const x = scX(c), y = scY(c);
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h);
    });

    const PAD = 20;
    const bw = maxX - minX + PAD * 2;
    const bh = maxY - minY + PAD * 2;
    const scale = Math.min((cw - 20) / bw, (ch - 20) / bh, 1);
    const ox = (cw - bw * scale) / 2 - (minX - PAD) * scale;
    const oy = (ch - bh * scale) / 2 - (minY - PAD) * scale;

    // Connections
    connections.forEach(conn => {
      const from = cards.find(c => c.id === conn.from);
      const to = cards.find(c => c.id === conn.to);
      if (!from || !to) return;
      const { w: fw, h: fh } = cdims(from);
      const { w: tw, h: th } = cdims(to);
      const fx = scX(from) * scale + ox + fw * scale / 2;
      const fy = scY(from) * scale + oy + fh * scale / 2;
      const tx = scX(to) * scale + ox + tw * scale / 2;
      const ty = scY(to) * scale + oy + th * scale / 2;

      ctx.strokeStyle = (conn as any).system ? 'rgba(129,140,248,0.2)' : 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      if ((conn as any).system) ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.bezierCurveTo(fx + (tx - fx) * 0.5, fy, fx + (tx - fx) * 0.5, ty, tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Cards
    cards.forEach(c => {
      const { w, h } = cdims(c);
      const x = scX(c) * scale + ox;
      const y = scY(c) * scale + oy;
      const sw = w * scale;
      const sh = h * scale;
      const isFocused = c.id === focusedCard.id;

      ctx.fillStyle = c.type === 'annotationNode' ? '#111118' : '#1a1a1a';
      ctx.fillRect(x, y, sw, sh);

      if (c.type === 'post') {
        const sc = statusColor2(c.status ?? null);
        ctx.fillStyle = sc;
        ctx.fillRect(x, y, Math.max(2, 4 * scale), sh);
      } else if (c.type === 'annotationNode') {
        ctx.fillStyle = 'rgba(129,140,248,0.4)';
        ctx.fillRect(x, y, sw, Math.max(1, 2 * scale));
      }

      if (isFocused) {
        ctx.strokeStyle = '#E55A1B';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#E55A1B60';
        ctx.shadowBlur = 6;
        ctx.strokeRect(x - 1, y - 1, sw + 2, sh + 2);
        ctx.shadowBlur = 0;
      }

      if (scale > 0.3) {
        ctx.fillStyle = c.type === 'annotationNode' ? 'rgba(255,255,255,0.5)' : '#e0deda';
        ctx.font = `${Math.max(7, 10 * scale)}px "DM Sans", sans-serif`;
        const title = c.type === 'annotationNode'
          ? (c.annotationPreview || c.noteText || 'annotation')
          : (c.title || '');
        ctx.fillText(title.slice(0, 16), x + 5 * scale, y + 14 * scale);
      }
    });
  }, [cards, connections, focusedCard]);

  useEffect(() => {
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [draw]);

  return <div ref={containerRef} className="absolute inset-0"><canvas ref={canvasRef} className="w-full h-full" /></div>;
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <p className="text-xs text-muted-foreground/40 text-center">{message}</p>
    </div>
  );
}
