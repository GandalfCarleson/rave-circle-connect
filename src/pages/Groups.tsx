import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { GroupCard } from '@/components/GroupCard';
import { BottomNav } from '@/components/BottomNav';
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

interface Group {
  id: string;
  name: string;
  city: string | null;
  is_private: boolean;
  image_url: string | null;
  member_count: number;
}

export default function Groups() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    city: '',
    isPrivate: true,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchGroups();
    }
  }, [user]);

  const fetchGroups = async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      // Get groups where user is a member
      const { data: memberGroups, error: memberError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);
      
      if (memberError) throw memberError;
      
      if (memberGroups && memberGroups.length > 0) {
        const groupIds = memberGroups.map(m => m.group_id);
        
        const { data: groupsData, error: groupsError } = await supabase
          .from('groups')
          .select('*')
          .in('id', groupIds);
        
        if (groupsError) throw groupsError;
        
        if (groupsData) {
          // Get member counts
          const groupsWithCounts = await Promise.all(
            groupsData.map(async (group) => {
              const { count } = await supabase
                .from('group_members')
                .select('*', { count: 'exact', head: true })
                .eq('group_id', group.id);
              return { ...group, member_count: count || 0 };
            })
          );
          setGroups(groupsWithCounts);
        }
      } else {
        setGroups([]);
      }
    } catch (error: any) {
      console.error('Error fetching groups:', error);
      toast({
        title: 'Error loading groups',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
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
    } catch (error: any) {
      console.error('Full error:', error);
      toast({
        title: 'Failed to create crew',
        description: error.message || 'Something went wrong. Please try again.',
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
    <div className="min-h-screen gradient-bg pb-24">
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
            {groups.map((group, index) => (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <GroupCard
                  id={group.id}
                  name={group.name}
                  city={group.city || undefined}
                  isPrivate={group.is_private}
                  memberCount={group.member_count}
                  imageUrl={group.image_url || undefined}
                  onClick={() => navigate(`/groups/${group.id}`)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}