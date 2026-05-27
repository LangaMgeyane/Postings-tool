import React, { useState, useEffect, useRef } from 'react';
import { useGetPost, useUpdatePost, useSubmitPost, getGetPostQueryKey, getListPostsQueryKey } from '@workspace/api-client-react';
import { getSession, setSession } from '@/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Send, Bold, Italic, List, Quote, RemoveFormatting } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PostEditorProps {
  onBack?: () => void;
}

export function PostEditor({ onBack }: PostEditorProps) {
  const session = getSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const postId = session?.selectedPostId;
  const initializedForId = useRef<string | null>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false });

  const { data: post, isLoading } = useGetPost(postId || '', {
    query: {
      enabled: !!postId,
      queryKey: getGetPostQueryKey(postId || '')
    }
  });

  const updatePost = useUpdatePost();
  const submitPost = useSubmitPost();

  useEffect(() => {
    if (post && initializedForId.current !== post.id) {
      initializedForId.current = post.id;
      setTitle(post.title || '');
      setCategory(post.category || '');
      setTags(post.tags?.join(', ') || '');
      if (editorRef.current) {
        editorRef.current.innerHTML = post.body || '';
      }
    }
  }, [post]);

  const updateFormats = () => {
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
    });
  };

  const handleSave = async (silent = false) => {
    if (!postId) return;
    const body = editorRef.current?.innerHTML || '';
    const excerpt = editorRef.current?.innerText.slice(0, 200) || '';

    // localStorage offline fallback
    const draft = { postId, title, category, tags, body, excerpt, savedAt: Date.now() };
    try {
      localStorage.setItem(`draft-${postId}`, JSON.stringify(draft));
    } catch {}

    try {
      await updatePost.mutateAsync({
        postId,
        data: {
          title,
          category,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
          body,
          excerpt,
        }
      });
      if (!silent) toast({ title: 'Draft saved' });
      queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(postId) });
    } catch (e: any) {
      if (!silent) toast({ title: 'Failed to save', description: e.message, variant: 'destructive' });
    }
  };

  const handleSubmit = async () => {
    if (!postId) return;
    const result = window.confirm('Submit this post for review? It will be locked for editing.');
    if (!result) return;

    await handleSave(true);
    try {
      await submitPost.mutateAsync({ postId });
      toast({ title: 'Submitted for review' });
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
      setSession({ selectedPostId: '', currentSubspace: 'c1' });
      onBack?.();
    } catch (e: any) {
      toast({ title: 'Submission failed', description: e.message, variant: 'destructive' });
    }
  };

  const execCommand = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    updateFormats();
  };

  if (!postId) return null;
  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading editor...</div>;
  if (!post) return <div className="p-8 text-destructive text-sm">Post not found</div>;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Toolbar */}
      <div className="h-12 border-b border-border/40 flex items-center justify-between px-4 shrink-0 bg-surface/60">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
          onClick={onBack}
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back
        </Button>
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-border/50"
            onClick={() => handleSave()}
            disabled={updatePost.isPending}
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Save Draft
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleSubmit}
            disabled={submitPost.isPending}
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Submit
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-10 space-y-5">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Post Title"
            className="w-full text-3xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/20 focus:ring-0 tracking-tight"
          />
          <div className="flex gap-3">
            <Input
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="Category"
              className="max-w-[160px] h-7 text-xs bg-surface/50 border-border/40 font-mono"
            />
            <Input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="tags, comma, separated"
              className="max-w-[280px] h-7 text-xs bg-surface/50 border-border/40 font-mono"
            />
          </div>

          {/* Rich text toolbar */}
          <div className="flex gap-0.5 p-1 bg-surface border border-border/40 rounded w-fit">
            {[
              { icon: Bold, cmd: 'bold', active: activeFormats.bold },
              { icon: Italic, cmd: 'italic', active: activeFormats.italic },
            ].map(({ icon: Icon, cmd, active }) => (
              <button
                key={cmd}
                onMouseDown={e => { e.preventDefault(); execCommand(cmd); }}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  active ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-raised"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
            <div className="w-px h-5 bg-border/50 mx-0.5 my-auto" />
            <button
              onMouseDown={e => { e.preventDefault(); execCommand('insertUnorderedList'); }}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-raised transition-colors"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onMouseDown={e => { e.preventDefault(); execCommand('formatBlock', 'blockquote'); }}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-raised transition-colors"
            >
              <Quote className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-5 bg-border/50 mx-0.5 my-auto" />
            <button
              onMouseDown={e => { e.preventDefault(); execCommand('removeFormat'); }}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-raised transition-colors"
            >
              <RemoveFormatting className="w-3.5 h-3.5" />
            </button>
          </div>

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onKeyUp={updateFormats}
            onMouseUp={updateFormats}
            onBlur={() => handleSave(true)}
            data-placeholder="Start writing..."
            className="min-h-[400px] outline-none text-base leading-relaxed text-foreground/85 pb-32 prose prose-invert max-w-none prose-p:mb-4 empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/25"
          />
        </div>
      </div>
    </div>
  );
}
