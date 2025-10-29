'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PollCard } from '@/components/PollCard';
import { CreatePollDialog } from '@/components/CreatePollDialog';
import { Plus, LogOut, LogIn, UserPlus, Loader2, ListFilter } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Poll, pollAPI } from '@/lib/api';
import { wsManager } from '@/lib/websocket';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, user, logout, initAuth } = useAuthStore();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filterMyPolls, setFilterMyPolls] = useState(false);

  // Initialize authentication
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // WebSocket connection and event handlers
  useEffect(() => {
    wsManager.connect();
    
    const handlePollCreated = (message: any) => {
      const newPoll = message.data;
      
      // Only add if it's active and not filtering by my polls
      // OR if filtering by my polls and it's created by current user
      const shouldAdd = newPoll.is_active && (
        !filterMyPolls || (user && newPoll.creator_id === user.id)
      );
      
      if (shouldAdd) {
        setPolls((prevPolls) => {
          const pollExists = prevPolls.some((poll) => poll.id === newPoll.id);
          if (pollExists) return prevPolls;
          return [newPoll, ...prevPolls];
        });
      }
    };

    const handlePollDeleted = (message: any) => {
      const deletedPollId = message.poll_id;
      setPolls((prevPolls) => prevPolls.filter((poll) => poll.id !== deletedPollId));
    };

    const handlePollUpdated = (message: any) => {
      const updatedPoll = message.data;
      
      console.log('Poll updated:', updatedPoll.id, 'is_active:', updatedPoll.is_active);

      setPolls((prevPolls) => {
        const existingPoll = prevPolls.find((poll) => poll.id === updatedPoll.id);
        
        // Determine if poll should be visible based on current filter
        const shouldBeVisible = updatedPoll.is_active && (
          !filterMyPolls || (user && updatedPoll.creator_id === user.id)
        );

        console.log('Should be visible:', shouldBeVisible, 'Exists:', !!existingPoll);

        // If poll should not be visible, remove it
        if (!shouldBeVisible) {
          return prevPolls.filter((poll) => poll.id !== updatedPoll.id);
        }
        
        // If poll exists, update it
        if (existingPoll) {
          return prevPolls.map((poll) =>
            poll.id === updatedPoll.id ? updatedPoll : poll
          );
        }
        
        // If poll doesn't exist but should be visible (reactivated), add it at the top
        console.log('Adding reactivated poll to list');
        return [updatedPoll, ...prevPolls];
      });
    };

    const handleVoteUpdate = (message: any) => {
      const { poll_id, data } = message;
      
      setPolls((prevPolls) =>
        prevPolls.map((poll) => {
          if (poll.id === poll_id) {
            return {
              ...poll,
              options: data.options,
              total_votes: data.total_votes,
            };
          }
          return poll;
        })
      );
    };

    const handleLikeUpdate = (message: any) => {
      const { poll_id, data } = message;
      
      setPolls((prevPolls) =>
        prevPolls.map((poll) => {
          if (poll.id === poll_id) {
            return {
              ...poll,
              total_likes: data.total_likes,
            };
          }
          return poll;
        })
      );
    };

    wsManager.on('poll_created', handlePollCreated);
    wsManager.on('poll_deleted', handlePollDeleted);
    wsManager.on('poll_update', handlePollUpdated);
    wsManager.on('vote_update', handleVoteUpdate);
    wsManager.on('like_update', handleLikeUpdate);
    
    return () => {
      wsManager.off('poll_created', handlePollCreated);
      wsManager.off('poll_deleted', handlePollDeleted);
      wsManager.off('poll_update', handlePollUpdated);
      wsManager.off('vote_update', handleVoteUpdate);
      wsManager.off('like_update', handleLikeUpdate);
      wsManager.disconnect();
    };
  }, [filterMyPolls, user?.id]);

  // Load polls when filter changes
  useEffect(() => {
    setPage(1);
    setPolls([]);
    setHasMore(true);
    loadPolls(1);
  }, [filterMyPolls, user?.id]);

  // Load more polls when page changes
  useEffect(() => {
    if (page > 1) {
      loadPolls(page);
    }
  }, [page]);

  const loadPolls = async (currentPage: number) => {
    try {
      setIsLoading(true);
      const creatorId = filterMyPolls && user ? user.id : undefined;
      const data = await pollAPI.getPolls(currentPage, 20, creatorId);
      
      if (currentPage === 1) {
        setPolls(data.polls);
      } else {
        setPolls((prevPolls) => [...prevPolls, ...data.polls]);
      }
      
      setHasMore(currentPage < data.total_pages);
    } catch (error) {
      console.error('Error loading polls:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handlePollUpdate = (updatedPoll: Poll) => {
    setPolls((prevPolls) => {
      // Check if poll should be visible based on filter
      const shouldBeVisible = updatedPoll.is_active && (
        !filterMyPolls || (user && updatedPoll.creator_id === user.id)
      );

      // If poll should not be visible, remove it
      if (!shouldBeVisible) {
        return prevPolls.filter((poll) => poll.id !== updatedPoll.id);
      }
      
      // If poll should be visible, update it
      return prevPolls.map((poll) =>
        poll.id === updatedPoll.id ? updatedPoll : poll
      );
    });
  };

  const handlePollDelete = (pollId: number) => {
    setPolls((prevPolls) => prevPolls.filter((poll) => poll.id !== pollId));
  };

  const toggleFilter = () => {
    setFilterMyPolls((prev) => !prev);
  };

  const handleCreateSuccess = () => {
    setPage(1);
    setPolls([]);
    loadPolls(1);
    setShowCreateDialog(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                QuickPoll
              </h1>
              <p className="text-sm text-muted-foreground hidden sm:block">
                Real-Time Opinion Polling
              </p>
            </div>

            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <>
                  <span className="text-sm text-muted-foreground hidden sm:block">
                    Welcome, <span className="font-medium text-foreground">{user?.username}</span>
                  </span>
                  <Button
                    onClick={() => setShowCreateDialog(true)}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Create Poll</span>
                  </Button>
                  <Button variant="outline" onClick={handleLogout} className="gap-2">
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Logout</span>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => router.push('/login')}
                    className="gap-2"
                  >
                    <LogIn className="h-4 w-4" />
                    Login
                  </Button>
                  <Button
                    onClick={() => router.push('/register')}
                    className="gap-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    Register
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold mb-2">
                {filterMyPolls ? 'My Polls' : 'Active Polls'}
              </h2>
              <p className="text-muted-foreground">
                {filterMyPolls 
                  ? 'Manage and track your created polls'
                  : 'Vote on polls and see results update in real-time'
                }
              </p>
            </div>
            
            {isAuthenticated && (
              <Button
                variant={filterMyPolls ? "default" : "outline"}
                onClick={toggleFilter}
                className="gap-2 w-full sm:w-auto"
              >
                <ListFilter className="h-4 w-4" />
                {filterMyPolls ? 'Show All Polls' : 'Show My Polls'}
              </Button>
            )}
          </div>

          {isLoading && page === 1 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading polls...</p>
            </div>
          ) : polls.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-4">
                <p className="text-lg text-muted-foreground mb-2">
                  {filterMyPolls 
                    ? "You haven't created any polls yet" 
                    : 'No active polls available'
                  }
                </p>
                <p className="text-sm text-muted-foreground">
                  {filterMyPolls
                    ? 'Create your first poll to get started'
                    : 'Be the first to create a poll'
                  }
                </p>
              </div>
              {isAuthenticated && (
                <Button 
                  onClick={() => setShowCreateDialog(true)} 
                  className="gap-2"
                  size="lg"
                >
                  <Plus className="h-5 w-5" />
                  Create Your First Poll
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-6">
                {polls.map((poll) => (
                  <PollCard
                    key={poll.id}
                    poll={poll}
                    onUpdate={handlePollUpdate}
                    onDelete={handlePollDelete}
                  />
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center mt-8">
                  <Button
                    variant="outline"
                    onClick={() => setPage((prevPage) => prevPage + 1)}
                    disabled={isLoading}
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading more polls...
                      </>
                    ) : (
                      'Load More Polls'
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {showCreateDialog && (
        <CreatePollDialog
          onClose={() => setShowCreateDialog(false)}
          onSuccess={handleCreateSuccess}
        />
      )}
    </div>
  );
}