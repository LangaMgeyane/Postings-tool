import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCreateNote } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { getListNotesQueryKey } from '@workspace/api-client-react';

interface NoteModalProps {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NoteModal({ postId, open, onOpenChange }: NoteModalProps) {
  const [text, setText] = useState('');
  const { toast } = useToast();
  const createNote = useCreateNote();
  const queryClient = useQueryClient();

  const handleSubmit = async () => {
    if (!text.trim()) return;
    try {
      await createNote.mutateAsync({
        postId,
        data: { text: text.trim() }
      });
      toast({ title: 'Note added' });
      setText('');
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: getListNotesQueryKey(postId) });
    } catch (e: any) {
      toast({ title: 'Failed to add note', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-surface border-border text-foreground">
        <DialogHeader>
          <DialogTitle>Add Note</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Textarea 
            value={text} 
            onChange={e => setText(e.target.value)} 
            placeholder="Type your note here..."
            className="min-h-[100px] bg-background border-border"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">Cancel</Button>
          <Button onClick={handleSubmit} disabled={!text.trim() || createNote.isPending}>
            {createNote.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
