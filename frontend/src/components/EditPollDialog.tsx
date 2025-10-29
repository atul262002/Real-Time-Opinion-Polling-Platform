'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { X, AlertCircle } from 'lucide-react';
import { pollAPI, Poll } from '@/lib/api';
import { Alert, AlertDescription } from './ui/alert';

interface EditPollDialogProps {
  poll: Poll;
  onClose: () => void;
  onSuccess: (updatedPoll: Poll) => void;
}

export function EditPollDialog({ poll, onClose, onSuccess }: EditPollDialogProps) {
  const [title, setTitle] = useState(poll.title);
  const [description, setDescription] = useState(poll.description || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedPoll = await pollAPI.updatePoll(poll.id, {
        title: title.trim(),
        description: description.trim() || null,
      });
      onSuccess(updatedPoll);
      onClose();
    } catch (error: any) {
      console.error('Error updating poll:', error);
      setError(error.response?.data?.detail || 'Failed to update poll');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Edit Poll</CardTitle>
              <CardDescription>Update your poll details</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="edit-title" className="text-sm font-medium">
                Poll Title *
              </label>
              <Input
                id="edit-title"
                placeholder="What's your question?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                required
              />
              <p className="text-xs text-muted-foreground">
                {title.length}/200 characters
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="edit-description" className="text-sm font-medium">
                Description (optional)
              </label>
              <Textarea
                id="edit-description"
                placeholder="Add more context to your poll"
                value={description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                maxLength={1000}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {description.length}/1000 characters
              </p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Note: Poll options cannot be edited after creation. You can only update the title and description.
              </AlertDescription>
            </Alert>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">Current Options:</p>
              <ul className="space-y-1">
                {poll.options.map((option, index) => (
                  <li key={option.id} className="text-sm text-muted-foreground">
                    {index + 1}. {option.text}
                  </li>
                ))}
              </ul>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : 'Update Poll'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}