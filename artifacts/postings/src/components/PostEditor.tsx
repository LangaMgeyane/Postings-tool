import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGetPost, useUpdatePost, useSubmitPost, getGetPostQueryKey } from '@workspace/api-client-react';
import { getSession, setSession } from '@/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Send, Bold, Italic, List, Quote, RemoveFormatting } from 'lucide-react';

export function PostEditor() {
  const session = getSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const postId = session?.selectedPostId;
  const initializedForId = useRef<string | null>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);

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
      if (editorRef.current && post.body !== editorRef.current.innerHTML) {
        editorRef.current.innerHTML = post.body || '';
      }
    }
  }, [post]);

  const handleSave = async (auto = false) => {
    if (!postId) return;
    
    const body = editorRef.current?.innerHTML || '';
    const excerpt = editorRef.current?.innerText.slice(0, 150) || '';
    
    try {
      await updatePost.mutateAsync({
        postId,
        data: {
          title,
          category,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
          body,
          excerpt
        }
      });
      if (!auto) toast({ title: 'Draft saved' });
      queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(postId) });
    } catch (e: any) {
      if (!auto) toast({ title: 'Failed to save', description: e.message, variant: 'destructive' });
    }
  };

  const handleSubmit = async () => {
    if (!postId) return;
    if (window.confirm("Submit this post for review? It will be locked for editing.")) {
      await handleSave(true);
      try {
        await submitPost.mutateAsync({ postId });
        toast({ title: 'Post submitted for review' });
        setSession({ currentSubspace: 'c1' }); // Switch to main journal
        window.location.reload();
      } catch (e: any) {
        toast({ title: 'Submission failed', description: e.message, variant: 'destructive' });
      }
    }
  };

  const execCommand = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
  };

  if (!postId) return <div className="p-8 text-center text-muted-foreground">Select a draft to edit</div>;
  if (isLoading) return <div className="p-8">Loading editor...</div>;

  return (
    <div className="h-full flex flex-col bg-background relative">
      <div className="h-14 border-b border-border/50 flex items-center justify-between px-4 shrink-0 bg-surface">
        <Button variant="ghost" size="sm" onClick={() => setSession({ selectedPostId: '' })}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleSave()} disabled={updatePost.isPending}>
            <Save className="w-4 h-4 mr-2" />
            Save Draft
          </Button>
          <Button variant="default" size="sm" onClick={handleSubmit} disabled={submitPost.isPending}>
            <Send className="w-4 h-4 mr-2" />
            Submit
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Post Title"
            className="w-full text-4xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/30 focus:ring-0"
          />
          <div className="flex gap-4">
            <Input 
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="Category" 
              className="max-w-[200px] h-8 text-xs bg-surface border-border/50" 
            />
            <Input 
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="Tags (comma separated)" 
              className="max-w-[300px] h-8 text-xs bg-surface border-border/50" 
            />
          </div>

          <div className="sticky top-0 z-20 flex gap-1 p-1 bg-surface border border-border/50 rounded-md shadow-sm w-fit">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('bold')}><Bold className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('italic')}><Italic className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('insertUnorderedList')}><List className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('formatBlock', 'blockquote')}><Quote className="w-4 h-4" /></Button>
            <div className="w-px h-8 bg-border/50 mx-1" />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('removeFormat')}><RemoveFormatting className="w-4 h-4" /></Button>
          </div>

          <div
            ref={editorRef}
            contentEditable
            data-placeholder="Start writing..."
            className="min-h-[400px] prose prose-invert prose-orange max-w-none font-serif leading-relaxed text-lg outline-none"
            onBlur={() => handleSave(true)}
          />
        </div>
      </div>
    </div>
  );
}
