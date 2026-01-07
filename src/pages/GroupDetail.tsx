import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Lock, Globe, Send, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageBubble } from '@/components/MessageBubble';
import { EventCard } from '@/components/EventCard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface Group {
  id: string;
  name: string;
  description: string | null;
  city: string | null;
  is_private: boolean;
  image_url: string | null;
}

interface Message {
  id: string;
  text: string | null;
  created_at: string;
  user_id: string;
  attached_event_id: string | null;
  sender_name: string;
  sender_avatar: string | null;
  attached_event?: {
    id: string;
    name: string;
    venue_name: string | null;
    city: string | null;
    start_datetime: string;
    image_url: string | null;
    event_type: string | null;
  };
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  name: string | null;
  avatar_url: string | null;
}

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchGroup();
      fetchMessages();
      fetchMembers();

      // Set up realtime subscription
      const channel = supabase
        .channel(`group-${id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `group_id=eq.${id}`,
          },
          async (payload) => {
            const newMsg = payload.new as any;
            // Fetch sender info
            const { data: profile } = await supabase
              .from('profiles')
              .select('name, avatar_url')
              .eq('user_id', newMsg.user_id)
              .single();
            
            setMessages(prev => [...prev, {
              ...newMsg,
              sender_name: profile?.name || 'Unknown',
              sender_avatar: profile?.avatar_url,
            }]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchGroup = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('groups')
      .select('*')
      .eq('id', id)
      .single();
    
    if (data) setGroup(data);
    setLoading(false);
  };

  const fetchMessages = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('messages')
      .select(`
        *,
        profiles:user_id (name, avatar_url),
        events:attached_event_id (id, name, venue_name, city, start_datetime, image_url, event_type)
      `)
      .eq('group_id', id)
      .order('created_at', { ascending: true });
    
    if (data) {
      setMessages(data.map((msg: any) => ({
        ...msg,
        sender_name: msg.profiles?.name || 'Unknown',
        sender_avatar: msg.profiles?.avatar_url,
        attached_event: msg.events,
      })));
    }
  };

  const fetchMembers = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('group_members')
      .select(`
        *,
        profiles:user_id (name, avatar_url)
      `)
      .eq('group_id', id);
    
    if (data) {
      setMembers(data.map((m: any) => ({
        ...m,
        name: m.profiles?.name,
        avatar_url: m.profiles?.avatar_url,
      })));
    }
  };

  const sendMessage = async () => {
    if (!user || !id || !newMessage.trim()) return;
    setSending(true);

    const { error } = await supabase
      .from('messages')
      .insert({
        group_id: id,
        user_id: user.id,
        text: newMessage.trim(),
      });

    if (!error) {
      setNewMessage('');
    }
    setSending(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <p className="text-muted-foreground">Group not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 glass border-b border-border/50">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/groups')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-display font-bold truncate">{group.name}</h1>
                {group.is_private ? (
                  <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <Globe className="w-4 h-4 text-secondary flex-shrink-0" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {members.length} {members.length === 1 ? 'member' : 'members'}
                {group.city && ` • ${group.city}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="chat" className="flex-1 flex flex-col">
        <div className="max-w-lg mx-auto w-full px-4 pt-2">
          <TabsList className="w-full bg-muted">
            <TabsTrigger value="chat" className="flex-1">Chat</TabsTrigger>
            <TabsTrigger value="events" className="flex-1">Events</TabsTrigger>
            <TabsTrigger value="members" className="flex-1">Members</TabsTrigger>
          </TabsList>
        </div>

        {/* Chat Tab */}
        <TabsContent value="chat" className="flex-1 flex flex-col m-0">
          <div className="flex-1 overflow-y-auto max-w-lg mx-auto w-full px-4 py-4">
            {messages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  text={message.text || undefined}
                  senderName={message.sender_name}
                  senderAvatar={message.sender_avatar || undefined}
                  timestamp={message.created_at}
                  isSent={message.user_id === user?.id}
                  attachedEvent={message.attached_event ? {
                    id: message.attached_event.id,
                    name: message.attached_event.name,
                    venueName: message.attached_event.venue_name || undefined,
                    city: message.attached_event.city || undefined,
                    startDatetime: message.attached_event.start_datetime,
                    imageUrl: message.attached_event.image_url || undefined,
                    eventType: message.attached_event.event_type || undefined,
                  } : undefined}
                  onViewEvent={() => message.attached_event && navigate(`/events/${message.attached_event.id}`)}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="glass border-t border-border/50 p-4">
            <div className="max-w-lg mx-auto flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                className="flex-1 bg-muted border-border/50"
              />
              <Button
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending}
                variant="neon"
                size="icon"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="flex-1 m-0">
          <div className="max-w-lg mx-auto px-4 py-4">
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No pinned events yet</p>
              <p className="text-sm mt-1">Share events from the Feed to pin them here</p>
            </div>
          </div>
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="flex-1 m-0">
          <div className="max-w-lg mx-auto px-4 py-4 space-y-2">
            {members.map((member) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-neon rounded-xl border border-border/50 p-3 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-muted overflow-hidden flex-shrink-0">
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt={member.name || ''} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-medium text-muted-foreground">
                      {(member.name || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{member.name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
