import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useCreatePost } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { getSession } from '@/session';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  category: z.string().min(1, "Category is required"),
  tags: z.string().optional(),
});

interface NewPostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function NewPostModal({ open, onOpenChange, onSuccess }: NewPostModalProps) {
  const { toast } = useToast();
  const session = getSession();
  const createPost = useCreatePost();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      category: "",
      tags: "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!session) return;
    
    createPost.mutate({
      data: {
        title: values.title,
        category: values.category,
        tags: values.tags ? values.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        body: "",
        excerpt: "",
      }
    }, {
      onSuccess: () => {
        toast({ title: "Draft created successfully" });
        form.reset();
        onOpenChange(false);
        onSuccess?.();
      },
      onError: (err: any) => {
        toast({ title: "Failed to create draft", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-surface border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-sans">New Draft</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">Title</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-background border-border" placeholder="Post title" />
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
                  <FormLabel className="text-muted-foreground">Category</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-background border-border" placeholder="e.g. Editorial, Review, Essay" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">Tags (comma separated)</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-background border-border" placeholder="design, critique, urbanism" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="bg-transparent border-border hover:bg-raised text-foreground">
                Cancel
              </Button>
              <Button type="submit" disabled={createPost.isPending} className="bg-primary text-primary-foreground">
                {createPost.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Draft
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
