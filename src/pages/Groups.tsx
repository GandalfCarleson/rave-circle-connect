import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format, isToday } from 'date-fns';
import { Plus, Users, Loader2, MoreVertical, LogOut, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { GroupCard } from '@/components/GroupCard';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { leaveCrew, deleteCrew } from '@/services/crewMembershipService';

interface Group {
  id: string;
  name: string;
  city: string | null;
  is_private: boolean;
  image_url: string | null;
  member_count: number;
  owner_id?: string;
  role?: string | null;
  last_activity_at?: string | null;
  last_activity_preview?: string | null;
}

interface GroupActivityRow {
  group_id: string;
  last_activity_at: string | null;
  last_activity_preview: string | null;
}

export default function Groups() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionGroup, setActionGroup] = useState<Group | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    city: '',
    isPrivate: true,
  });
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const typingChannelsRef = useRef<Map<string, ReturnType<typeof supabase.channel>>>(new Map());
  const [typingByGroup, setTypingByGroup] = useState<Record<string, Record<string, { expiresAt: number; name: string }>>>({});
  const presenceChannelsRef = useRef<Map<string, ReturnType<typeof supabase.channel>>>(new Map());
  const [onlineByGroup, setOnlineByGroup] = useState<Record<string, string[]>>({});

  const fetchGroups = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      const { data: groupRows, error: groupError } = await supabase.rpc('get_user_groups');
      if (groupError) throw groupError;

      if (groupRows && groupRows.length > 0) {
        const groupIds = groupRows.map((group) => group.id);

        const groupsWithCounts = await Promise.all(
          groupRows.map(async (group) => {
            const { count } = await supabase
              .from('group_members')
              .select('*', { count: 'exact', head: true })
              .eq('group_id', group.id);
            return {
              ...group,
              member_count: count || 0,
            } as Group;
          })
        );

        const { data: activities } = groupIds.length > 0
          ? await supabase
              .from('group_last_activity')
              .select('group_id, last_activity_at, last_activity_preview')
              .in('group_id', groupIds)
          : { data: [] as GroupActivityRow[] };

        const activityByGroup = new Map(
          (activities as GroupActivityRow[] || []).map(activity => [activity.group_id, activity])
        );

        const merged = groupsWithCounts.map(group => {
          const activity = activityByGroup.get(group.id);
          return {
            ...group,
            last_activity_at: activity?.last_activity_at ?? null,
            last_activity_preview: activity?.last_activity_preview ?? null,
          };
        });

        merged.sort((a, b) => {
          const aTime = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
          const bTime = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
          return bTime - aTime;
        });

        setGroups(merged);
      } else {
        setGroups([]);
      }
    } catch (error: unknown) {
      console.error('Error fetching groups:', error);
      const message = error instanceof Error ? error.message : 'Failed to load groups.';
      toast({
        title: 'Error loading groups',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchGroups();
    }
  }, [fetchGroups, user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`group-members-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_members',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchGroups();
        }
      )
      .subscribe();

    const handleFocus = () => {
      fetchGroups();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchGroups, user]);

  useEffect(() => {
    if (!user) return;
    const typingChannels = typingChannelsRef.current;
    const activeGroups = new Set(groups.map(group => group.id));
    typingChannels.forEach((channel, groupId) => {
      if (!activeGroups.has(groupId)) {
        supabase.removeChannel(channel);
        typingChannels.delete(groupId);
      }
    });

    groups.forEach((group) => {
      if (typingChannels.has(group.id)) return;
      const channel = supabase
        .channel(`typing-${group.id}`, { config: { broadcast: { self: false } } })
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          const userId = payload?.user_id as string | undefined;
          const isTyping = payload?.typing as boolean | undefined;
          if (!userId) return;
          const userName = (payload?.user_name as string | undefined) || 'Someone';
          setTypingByGroup((prev) => {
            const nextGroup = { ...(prev[group.id] || {}) };
            if (isTyping) {
              nextGroup[userId] = { expiresAt: Date.now() + 2500, name: userName };
            } else {
              delete nextGroup[userId];
            }
            return {
              ...prev,
              [group.id]: nextGroup,
            };
          });
        })
        .subscribe();
      typingChannels.set(group.id, channel);
    });

    return () => {
      typingChannels.forEach((channel) => supabase.removeChannel(channel));
      typingChannels.clear();
    };
  }, [user, groups]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTypingByGroup((prev) => {
        const next: Record<string, Record<string, { expiresAt: number; name: string }>> = {};
        Object.keys(prev).forEach((groupId) => {
          const entries = Object.entries(prev[groupId] || {}).filter(([, entry]) => entry.expiresAt > Date.now());
          if (entries.length > 0) {
            next[groupId] = Object.fromEntries(entries);
          }
        });
        return next;
      });
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!user) return;
    const presenceChannels = presenceChannelsRef.current;
    const activeGroups = new Set(groups.map(group => group.id));
    presenceChannels.forEach((channel, groupId) => {
      if (!activeGroups.has(groupId)) {
        supabase.removeChannel(channel);
        presenceChannels.delete(groupId);
        setOnlineByGroup((prev) => {
          const next = { ...prev };
          delete next[groupId];
          return next;
        });
      }
    });

    groups.forEach((group) => {
      if (presenceChannels.has(group.id)) return;
      const channel = supabase
        .channel(`presence-group-${group.id}`, {
          config: { presence: { key: user.id } },
        })
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const onlineIds = Object.keys(state).filter((id) => id !== user.id);
          setOnlineByGroup((prev) => ({
            ...prev,
            [group.id]: onlineIds,
          }));
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({ online_at: new Date().toISOString() });
          }
        });
      presenceChannels.set(group.id, channel);
    });

    const intervalId = window.setInterval(() => {
      presenceChannels.forEach((channel) => {
        channel.track({ online_at: new Date().toISOString() });
      });
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
      presenceChannels.forEach((channel) => supabase.removeChannel(channel));
      presenceChannels.clear();
    };
  }, [user, groups]);


  const formatActivityTime = (timestamp?: string | null) => {
    if (!timestamp) return undefined;
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return undefined;
    return isToday(date) ? format(date, 'HH:mm') : format(date, 'MMM d');
  };

  const closeMenus = () => {
    setContextMenuPos(null);
    setActionSheetOpen(false);
    setActionGroup(null);
  };

  const isOwner = (group: Group) => {
    if (!user) return false;
    return group.role === 'owner' || group.owner_id === user.id;
  };

  const openActionMenu = (group: Group, mode: 'sheet' | 'context', position?: { x: number; y: number }) => {
    setActionGroup(group);
    if (mode === 'context') {
      setContextMenuPos(position || { x: 0, y: 0 });
      setActionSheetOpen(false);
    } else {
      setActionSheetOpen(true);
      setContextMenuPos(null);
    }
  };

  const handlePointerDown = (group: Group, event: React.PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    longPressTriggeredRef.current = false;
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      openActionMenu(group, 'sheet');
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    }, 450);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!pointerStartRef.current || !longPressTimerRef.current) return;
    const dx = event.clientX - pointerStartRef.current.x;
    const dy = event.clientY - pointerStartRef.current.y;
    if (Math.hypot(dx, dy) > 12) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handlePointerEnd = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pointerStartRef.current = null;
  };

  const handleContextMenu = (group: Group, event: React.MouseEvent) => {
    event.preventDefault();
    const menuWidth = 200;
    const menuHeight = 120;
    const x = Math.min(event.clientX, window.innerWidth - menuWidth - 12);
    const y = Math.min(event.clientY, window.innerHeight - menuHeight - 12);
    openActionMenu(group, 'context', { x, y });
  };

  const handleThreeDots = (group: Group, event: React.MouseEvent) => {
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const menuWidth = 200;
    const menuHeight = 120;
    const x = Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12);
    const y = Math.min(rect.bottom + 6, window.innerHeight - menuHeight - 12);
    openActionMenu(group, 'context', { x, y });
  };

  const handleLeaveCrew = async (group: Group) => {
    if (!user) return;
    if (isOwner(group) && group.member_count > 1) {
      toast({
        title: 'Transfer ownership before leaving',
        description: 'You have other members in this crew.',
        variant: 'destructive',
      });
      return;
    }
    if (isOwner(group) && group.member_count <= 1) {
      setActionGroup(group);
      setConfirmDeleteOpen(true);
      return;
    }
    const { error } = await leaveCrew(group.id, user.id);
    if (error) {
      toast({
        title: 'Unable to leave crew',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    setGroups(prev => prev.filter(item => item.id !== group.id));
    toast({
      title: 'Left crew',
      description: 'You have left this crew.',
    });
    closeMenus();
  };

  const handleDeleteCrew = async (group: Group) => {
    if (!user) return;
    if (!isOwner(group)) {
      toast({
        title: 'Not allowed',
        description: 'Only owners can delete crews.',
        variant: 'destructive',
      });
      return;
    }
    const { error } = await deleteCrew(group.id);
    if (error) {
      toast({
        title: 'Unable to delete crew',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    setGroups(prev => prev.filter(item => item.id !== group.id));
    toast({
      title: 'Crew deleted',
      description: 'This crew has been removed.',
    });
    closeMenus();
  };

  const createGroup = async () => {
    if (!user) {
      toast({
        title: 'Not authenticated',
        description: 'Please log in to create a group',
        variant: 'destructive',
      });
      return;
    }

    if (!newGroup.name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a name for your crew',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);

    try {
      // Create the group
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: newGroup.name.trim(),
          description: newGroup.description.trim() || null,
          city: newGroup.city.trim() || null,
          is_private: newGroup.isPrivate,
          owner_id: user.id,
        })
        .select()
        .single();

      if (groupError) {
        console.error('Group creation error:', groupError);
        throw new Error(groupError.message);
      }

      if (!group) {
        throw new Error('No group returned after creation');
      }

      // Add creator as owner member
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: user.id,
          role: 'owner' as const,
        });

      if (memberError) {
        console.error('Member creation error:', memberError);
        // Try to clean up the group if member creation fails
        await supabase.from('groups').delete().eq('id', group.id);
        throw new Error(memberError.message);
      }

      toast({
        title: 'Crew created!',
        description: `${newGroup.name} is ready for your crew`,
      });

      setCreateOpen(false);
      setNewGroup({ name: '', description: '', city: '', isPrivate: true });
      fetchGroups();
    } catch (error: unknown) {
      console.error('Full error:', error);
      const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      toast({
        title: 'Failed to create crew',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const CreateGroupDialog = (
    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogTrigger asChild>
        <Button variant="neon" size="sm">
          <Plus className="w-4 h-4" />
          New Crew
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display">Create a Crew</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="name">Crew Name *</Label>
            <Input
              id="name"
              value={newGroup.name}
              onChange={(e) => setNewGroup(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Berlin Techno Crew"
              className="mt-1.5 bg-muted border-border/50"
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={newGroup.description}
              onChange={(e) => setNewGroup(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What's your crew about?"
              className="mt-1.5 bg-muted border-border/50 resize-none"
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={newGroup.city}
              onChange={(e) => setNewGroup(prev => ({ ...prev, city: e.target.value }))}
              placeholder="e.g. Berlin"
              className="mt-1.5 bg-muted border-border/50"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="private">Private Crew</Label>
              <p className="text-xs text-muted-foreground">Only invited members can join</p>
            </div>
            <Switch
              id="private"
              checked={newGroup.isPrivate}
              onCheckedChange={(checked) => setNewGroup(prev => ({ ...prev, isPrivate: checked }))}
            />
          </div>
          <Button
            onClick={createGroup}
            disabled={!newGroup.name.trim() || creating}
            className="w-full"
            variant="neon"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Crew'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="min-h-screen gradient-bg">
      <AnimatedBackground />
      
      {/* Header */}
      <div className="sticky top-0 z-40 glass border-b border-border/50">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-display font-bold">Your Crews</h1>
            {CreateGroupDialog}
          </div>
        </div>
      </div>

      {/* Groups List */}
      <div className="max-w-lg mx-auto px-4 py-4 relative z-10">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="card-neon rounded-xl border border-border/50 p-4 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-muted rounded-xl" />
                  <div className="flex-1">
                    <div className="h-4 bg-muted rounded w-2/3 mb-2" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-display font-semibold text-lg mb-2">No crews yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Create your first crew and invite your rave buddies
            </p>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button variant="neon">
                  <Plus className="w-4 h-4" />
                  Create Your First Crew
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="font-display">Create a Crew</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="name2">Crew Name *</Label>
                    <Input
                      id="name2"
                      value={newGroup.name}
                      onChange={(e) => setNewGroup(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Berlin Techno Crew"
                      className="mt-1.5 bg-muted border-border/50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description2">Description</Label>
                    <Textarea
                      id="description2"
                      value={newGroup.description}
                      onChange={(e) => setNewGroup(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="What's your crew about?"
                      className="mt-1.5 bg-muted border-border/50 resize-none"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="city2">City</Label>
                    <Input
                      id="city2"
                      value={newGroup.city}
                      onChange={(e) => setNewGroup(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="e.g. Berlin"
                      className="mt-1.5 bg-muted border-border/50"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="private2">Private Crew</Label>
                      <p className="text-xs text-muted-foreground">Only invited members can join</p>
                    </div>
                    <Switch
                      id="private2"
                      checked={newGroup.isPrivate}
                      onCheckedChange={(checked) => setNewGroup(prev => ({ ...prev, isPrivate: checked }))}
                    />
                  </div>
                  <Button
                    onClick={createGroup}
                    disabled={!newGroup.name.trim() || creating}
                    className="w-full"
                    variant="neon"
                  >
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Crew'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {groups.filter(group => group.id).map((group, index) => (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onContextMenu={(event) => handleContextMenu(group, event)}
                onPointerDown={(event) => handlePointerDown(group, event)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
              >
                <GroupCard
                  id={group.id}
                  name={group.name}
                  city={group.city || undefined}
                  isPrivate={group.is_private}
                  activityText={group.last_activity_preview || undefined}
                  activityNode={
                    (() => {
                      const groupTyping = typingByGroup[group.id] || {};
                      const activeTypers = Object.entries(groupTyping)
                        .filter(([id, entry]) => id !== user?.id && entry.expiresAt > Date.now());
                      if (activeTypers.length === 0) return undefined;
                      const typers = activeTypers.map(([, entry]) => entry.name || 'Someone');
                      const label = typers.length === 1
                        ? `${typers[0]} is typing`
                        : `${typers[0]} + ${typers.length - 1} more are typing`;
                      return (
                        <div className="flex items-center gap-2">
                          <span>{label}</span>
                          <div className="typing-indicator" aria-hidden="true">
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                          </div>
                        </div>
                      );
                    })()
                  }
                  activityTimestamp={formatActivityTime(group.last_activity_at)}
                  imageUrl={group.image_url || undefined}
                  onlineCount={(onlineByGroup[group.id] || []).length}
                  onClick={() => {
                    if (longPressTriggeredRef.current) {
                      longPressTriggeredRef.current = false;
                      return;
                    }
                    if (group.id) {
                      navigate(`/groups/${group.id}`);
                    }
                  }}
                  action={(
                    <button
                      type="button"
                      onClick={(event) => handleThreeDots(group, event)}
                      className="p-1 rounded-md hover:bg-muted/60"
                      aria-label="Crew actions"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  )}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {contextMenuPos && actionGroup && (
        <div
          className="fixed inset-0 z-50"
          onClick={closeMenus}
          onContextMenu={(event) => {
            event.preventDefault();
            closeMenus();
          }}
        >
          <div
            className="fixed card-neon border border-border/60 rounded-lg bg-card/95 backdrop-blur-sm shadow-lg p-2 w-[200px]"
            style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => handleLeaveCrew(actionGroup)}
              className="w-full text-left px-3 py-2 rounded-md text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Leave crew
            </button>
            {isOwner(actionGroup) && (
              <button
                type="button"
                onClick={() => {
                  setContextMenuPos(null);
                  setActionSheetOpen(false);
                  setConfirmDeleteOpen(true);
                }}
                className="w-full text-left px-3 py-2 rounded-md text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete crew
              </button>
            )}
          </div>
        </div>
      )}

      {actionSheetOpen && actionGroup && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={closeMenus} />
          <div className="absolute bottom-0 left-0 right-0 card-neon border border-border/60 rounded-t-2xl bg-card/95 backdrop-blur-sm p-4 space-y-3">
            <button
              type="button"
              onClick={() => handleLeaveCrew(actionGroup)}
              className="w-full text-left px-4 py-3 rounded-lg text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Leave crew
            </button>
            {isOwner(actionGroup) && (
              <button
                type="button"
                onClick={() => {
                  setContextMenuPos(null);
                  setActionSheetOpen(false);
                  setConfirmDeleteOpen(true);
                }}
                className="w-full text-left px-4 py-3 rounded-lg text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete crew
              </button>
            )}
            <button
              type="button"
              onClick={closeMenus}
              className="w-full text-left px-4 py-3 rounded-lg text-sm text-muted-foreground hover:bg-muted/30"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">Delete crew?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This removes the crew for everyone. This can’t be undone.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmDeleteOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => {
                  if (actionGroup) {
                    handleDeleteCrew(actionGroup);
                  }
                  setConfirmDeleteOpen(false);
                  setPendingAction(null);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
