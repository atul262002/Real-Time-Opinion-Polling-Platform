'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, CheckCircle2, Trash2, Edit, PauseCircle, PlayCircle } from 'lucide-react';
import { Poll, pollAPI } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { wsManager } from '@/lib/websocket';
import { cn } from '@/lib/utils';
import { EditPollDialog } from '@/components/EditPollDialog';

interface PollCardProps {
  poll: Poll;
  onUpdate: (poll: Poll) => void;
  onDelete: (pollId: number) => void;
}

export function PollCard({ poll: initialPoll, onUpdate, onDelete }: PollCardProps) {
  const { user, isAuthenticated } = useAuthStore();
  const [poll, setPoll] = useState(initialPoll);
  const [isVoting, setIsVoting] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingActive, setIsTogglingActive] = useState(false);

  const isCreator = user?.id === poll.creator_id;

  // Update poll when prop changes
  useEffect(() => {
    setPoll(initialPoll);
  }, [initialPoll]);

  // Subscribe to WebSocket updates for this poll
  useEffect(() => {
    wsManager.subscribe(poll.id);

    const handleVoteUpdate = (message: any) => {
      if (message.poll_id === poll.id) {
        setPoll((prev) => ({
          ...prev,
          options: message.data.options,
          total_votes: message.data.total_votes,
        }));
      }
    };

    const handleLikeUpdate = (message: any) => {
      if (message.poll_id === poll.id) {
        setPoll((prev) => ({
          ...prev,
          total_likes: message.data.total_likes,
        }));
      }
    };

    const handlePollUpdate = (message: any) => {
      if (message.poll_id === poll.id) {
        setPoll(message.data);
        onUpdate(message.data);
      }
    };

    wsManager.on('vote_update', handleVoteUpdate);
    wsManager.on('like_update', handleLikeUpdate);
    wsManager.on('poll_update', handlePollUpdate);

    return () => {
      wsManager.unsubscribe(poll.id);
      wsManager.off('vote_update', handleVoteUpdate);
      wsManager.off('like_update', handleLikeUpdate);
      wsManager.off('poll_update', handlePollUpdate);
    };
  }, [poll.id, onUpdate]);

  const handleVote = async (optionId: number) => {
    if (!isAuthenticated || isVoting) return;

    setIsVoting(true);
    try {
      await pollAPI.vote(poll.id, optionId);
      
      // Optimistically update local state
      setPoll((prev) => ({
        ...prev,
        user_voted: true,
        user_vote_option_id: optionId,
      }));
    } catch (error) {
      console.error('Error voting:', error);
    } finally {
      setIsVoting(false);
    }
  };

  const handleLike = async () => {
    if (!isAuthenticated || isLiking) return;

    setIsLiking(true);
    try {
      const result = await pollAPI.toggleLike(poll.id);
      
      // Optimistically update local state
      setPoll((prev) => ({
        ...prev,
        user_liked: result.is_liked,
        total_likes: result.total_likes,
      }));
    } catch (error) {
      console.error('Error toggling like:', error);
    } finally {
      setIsLiking(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this poll?')) return;

    setIsDeleting(true);
    try {
      await pollAPI.deletePoll(poll.id);
      onDelete(poll.id);
    } catch (error) {
      console.error('Error deleting poll:', error);
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async () => {
    setIsTogglingActive(true);
    try {
      const updatedPoll = await pollAPI.updatePoll(poll.id, {
        is_active: !poll.is_active,
      });
      setPoll(updatedPoll);
      onUpdate(updatedPoll);
    } catch (error) {
      console.error('Error toggling poll status:', error);
    } finally {
      setIsTogglingActive(false);
    }
  };

  const handleEditSuccess = (updatedPoll: Poll) => {
    setPoll(updatedPoll);
    onUpdate(updatedPoll);
    setShowEditDialog(false);
  };

  const getVotePercentage = (voteCount: number) => {
    if (poll.total_votes === 0) return 0;
    return Math.round((voteCount / poll.total_votes) * 100);
  };

  return (
    <>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-xl mb-2">{poll.title}</CardTitle>
              {poll.description && (
                <CardDescription className="text-sm">{poll.description}</CardDescription>
              )}
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs text-muted-foreground">
                  by {poll.creator_username}
                </span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(poll.created_at).toLocaleDateString()}
                </span>
                {poll.is_active ? (
                  <Badge variant="default" className="ml-2">Active</Badge>
                ) : (
                  <Badge variant="secondary" className="ml-2">Inactive</Badge>
                )}
              </div>
            </div>
            {isCreator && (
              <div className="flex gap-2 ml-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleActive}
                  disabled={isTogglingActive}
                  title={poll.is_active ? 'Deactivate poll' : 'Activate poll'}
                >
                  {poll.is_active ? (
                    <PauseCircle className="h-4 w-4" />
                  ) : (
                    <PlayCircle className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowEditDialog(true)}
                  title="Edit poll"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  title="Delete poll"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-3">
            {poll.options.map((option) => {
              const percentage = getVotePercentage(option.vote_count);
              const isSelected = poll.user_vote_option_id === option.id;
              const canVote = isAuthenticated && poll.is_active;

              return (
                <button
                  key={option.id}
                  onClick={() => canVote && handleVote(option.id)}
                  disabled={!canVote || isVoting}
                  className={cn(
                    'w-full text-left rounded-lg border-2 transition-all relative overflow-hidden',
                    'hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20',
                    isSelected && 'border-primary bg-primary/5',
                    !canVote && 'cursor-default',
                    isVoting && 'opacity-50 cursor-wait'
                  )}
                >
                  <div
                    className="absolute inset-0 bg-primary/10 transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                  <div className="relative p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      {isSelected && (
                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
                      <span className="font-medium">{option.text}</span>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {option.vote_count} {option.vote_count === 1 ? 'vote' : 'votes'}
                      </span>
                      {poll.total_votes > 0 && (
                        <span className="text-sm font-semibold text-primary whitespace-nowrap min-w-[3rem] text-right">
                          {percentage}%
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>

        <CardFooter className="flex items-center justify-between border-t pt-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{poll.total_votes} total votes</span>
          </div>
          <Button
            variant={poll.user_liked ? 'default' : 'outline'}
            size="sm"
            onClick={handleLike}
            disabled={!isAuthenticated || isLiking}
            className="gap-2"
          >
            <Heart className={cn('h-4 w-4', poll.user_liked && 'fill-current')} />
            {poll.total_likes}
          </Button>
        </CardFooter>
      </Card>

      {showEditDialog && (
        <EditPollDialog
          poll={poll}
          onClose={() => setShowEditDialog(false)}
          onSuccess={handleEditSuccess}
        />
      )}
    </>
  );
}