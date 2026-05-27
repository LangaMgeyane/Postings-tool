import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useCreatePost, getListPostsQueryKey } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { getSession, setSession } from '@/session';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  category: z.string().optional(),
  tags: z.string().optional(),
});

interface NewPostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (postId: string) => void;
}

export function NewPostModal({ open, onOpenChange, onSuccess }: NewPostModalProps) {
  const { toast } = useToast();
  const session = getSession();
  const createPost = useCreatePost();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", category: "", tags: "" },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!session) return;

    createPost.mutate({
      data: {
        title: values.title,
        category: values.category || "",
        tags: values.tags ? values.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        body: "",
        excerpt: "",
        authorId: session.userId,
        authorName: session.userName,
      } as any
    }, {
      onSuccess: (post) => {
        toast({ title: "Draft created" });
        form.reset();
        onOpenChange(false);
        queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
        setSession({ selectedPostId: post.id, isAuthorOfSelected: true });
        onSuccess?.(post.id);
      },
      onError: (err: any) => {
        toast({ title: "Failed to create draft", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] bg-surface border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold tracking-tight">New Draft</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider">Title</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-background border-border/60 font-medium" placeholder="Working title" autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider">Category</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-background border-border/60" placeholder="e.g. Culture, Reportage, Essay" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider">Tags</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-background border-border/60 font-mono text-sm" placeholder="design, critique, urbanism" />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-muted-foreground">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={createPost.isPending} className="bg-primary text-primary-foreground">
                {createPost.isPending && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                Create Draft
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
