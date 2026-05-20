import { useState, useEffect, useRef, useCallback } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Lock, Globe, Send, Calendar, Loader2, Copy, Pencil, Trash2, Reply, Smile } from 'lucide-react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MessageBubble } from '@/components/MessageBubble';
import { EventCard } from '@/components/EventCard';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  getCrewEventPinCounts,
  getCrewEventPinsForUser,
  getCrewPinnedEvents,
  pinCrewEvent,
  removeCrewEventFromCrew,
  unpinCrewEvent,
} from '@/services/crewEventsService';
import type { ExternalEvent } from '@/services/externalEventsService';

interface Group {
  id: string;
  name: string;
  description: string | null;
  city: string | null;
  is_private: boolean;
  image_url: string | null;
  owner_id: string;
}

interface Message {
  id: string;
  text: string | null;
  created_at: string;
  edited_at: string | null;
  retracted_at: string | null;
  expires_at?: string | null;
  is_retracted?: boolean | null;
  reply_to_message_id: string | null;
  message_type: 'text' | 'event' | 'system' | null;
  user_id: string | null;
  attached_event_id: string | null;
  sender_name: string;
  sender_avatar: string | null;
  attached_event?: {
    id: string;
    name: string;
    venue_name: string | null;
    city: string | null;
    start_datetime: string;
    end_datetime: string | null;
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

interface ReactionSummary {
  emoji: string;
  count: number;
  reactedByUser?: boolean;
}

type ProfileRow = {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
};

type EventRow = {
  id: string;
  name: string;
  venue_name: string | null;
  city: string | null;
  start_datetime: string;
  end_datetime: string | null;
  image_url: string | null;
  event_type: string | null;
};

type GroupMemberRow = {
  id: string;
  user_id: string;
  role: string;
  name: string | null;
  avatar_url: string | null;
};

const DEFAULT_RETRACT_TTL_SECONDS = 600;
const MIN_RETRACT_TTL_SECONDS = 30;
const MAX_RETRACT_TTL_SECONDS = 3600;

const getRetractTtlSeconds = () => {
  const raw = Number(import.meta.env.VITE_RETRACT_TTL_SECONDS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_RETRACT_TTL_SECONDS;
  return Math.min(MAX_RETRACT_TTL_SECONDS, Math.max(MIN_RETRACT_TTL_SECONDS, raw));
};

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍'];
const LEGACY_REACTION_MAP: Record<string, string> = {
  ':D': '😄',
  ':)': '😊',
  '<3': '❤️',
  '!!': '🔥',
};

const isSingleEmoji = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new (Intl as typeof Intl & {
      Segmenter: new (
        locales?: string | string[],
        options?: { granularity?: 'grapheme' | 'word' | 'sentence' },
      ) => { segment: (input: string) => Iterable<unknown> };
    }).Segmenter(undefined, { granularity: 'grapheme' });
    const segments = Array.from(segmenter.segment(trimmed));
    if (segments.length !== 1) return false;
  }
  return /[\p{Extended_Pictographic}]/u.test(trimmed);
};

const getDisplayName = (user: { email?: string; user_metadata?: { name?: string } } | null) => {
  if (!user) return 'Someone';
  const metaName = user.user_metadata?.name;
  if (metaName && metaName.trim()) return metaName.trim();
  if (user.email) return user.email.split('@')[0];
  return 'Someone';
};

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const groupId = id && id !== 'undefined' ? id : null;
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [reactionsByMessage, setReactionsByMessage] = useState<Record<string, ReactionSummary[]>>({});
  const [emojiPickerMessageId, setEmojiPickerMessageId] = useState<string | null>(null);
  const [customEmoji, setCustomEmoji] = useState('');
  const [reactionBar, setReactionBar] = useState<{ messageId: string; x: number; y: number } | null>(null);
  const reactionBarRef = useRef<HTMLDivElement | null>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, number>>({});
  const [crewPinCounts, setCrewPinCounts] = useState<Record<string, number>>({});
  const [crewPinNames, setCrewPinNames] = useState<Record<string, string[]>>({});
  const [crewPinnedByUser, setCrewPinnedByUser] = useState<Set<string>>(new Set());
  const [crewBoardEvents, setCrewBoardEvents] = useState<ExternalEvent[]>([]);
  const [groupReads, setGroupReads] = useState<Record<string, string>>({});
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [activeUsers, setActiveUsers] = useState<Set<string>>(new Set());
  const [actionMessage, setActionMessage] = useState<Message | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [confirmRetractOpen, setConfirmRetractOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviting, setInviting] = useState(false);
  const groupChatRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageEventIdsRef = useRef<string[]>([]);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const memberCount = Math.max(1, members.length);
  const requiredPins = Math.max(1, Math.ceil(memberCount * 0.6));
  const getPlanningStatus = (pinCount: number) => {
    if (pinCount >= requiredPins) return 'Crew Pick';
    if (pinCount > 0) return 'Considering';
    return 'Suggested';
  };

  const fetchGroup = useCallback(async () => {
    if (!groupId) return;
    const { data } = await supabase.rpc('get_group_for_member', { p_group_id: groupId });
    if (data && data.length > 0) {
      setGroup(data[0] as Group);
      setLoading(false);
      return;
    }
    setLoading(false);
  }, [groupId]);

  const fetchMessages = useCallback(async () => {
    if (!groupId) return;
    const { data: messageRows, error } = await supabase
      .from('messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });
    
    if (error || !messageRows) return;

    const userIds = Array.from(
      new Set(messageRows.map((msg) => msg.user_id).filter(Boolean) as string[])
    );
    const eventIds = Array.from(
      new Set(messageRows.map((msg) => msg.attached_event_id).filter(Boolean) as string[])
    );

    const [{ data: profiles }, { data: events }] = await Promise.all([
      userIds.length
        ? supabase
            .from('profiles')
            .select('user_id, name, avatar_url')
            .in('user_id', userIds)
        : Promise.resolve({ data: [] }),
      eventIds.length
        ? supabase
            .from('events')
            .select('id, name, venue_name, city, start_datetime, end_datetime, image_url, event_type')
            .in('id', eventIds)
        : Promise.resolve({ data: [] }),
    ]);

    const profileMap = new Map(
      ((profiles || []) as ProfileRow[]).map((profile) => [profile.user_id, profile])
    );
    const eventMap = new Map(((events || []) as EventRow[]).map((event) => [event.id, event]));

    setMessages(
      messageRows.map((msg) => {
        const profile = profileMap.get(msg.user_id);
        const attachedEvent = msg.attached_event_id
          ? eventMap.get(msg.attached_event_id)
          : undefined;
        return {
          ...msg,
          sender_name: profile?.name || 'Unknown',
          sender_avatar: profile?.avatar_url,
          attached_event: attachedEvent,
        };
      })
    );
  }, [groupId]);

  const runRetractedCleanup = useCallback(async () => {
    await supabase.rpc('cleanup_retracted_messages', { p_limit: 100 });
  }, []);

  const fetchReactions = useCallback(async () => {
    if (!user || messages.length === 0) return;
    const messageIds = messages.map(message => message.id);
    const { data } = await supabase
      .from('message_reactions')
      .select('message_id, emoji, user_id')
      .in('message_id', messageIds);

    const grouped: Record<string, Record<string, ReactionSummary>> = {};
    (data || []).forEach((reaction) => {
      const normalizedEmoji = LEGACY_REACTION_MAP[reaction.emoji] || reaction.emoji;
      if (!grouped[reaction.message_id]) {
        grouped[reaction.message_id] = {};
      }
      const messageGroup = grouped[reaction.message_id];
      const existing = messageGroup[normalizedEmoji] || {
        emoji: normalizedEmoji,
        count: 0,
        reactedByUser: false,
      };
      existing.count += 1;
      if (reaction.user_id === user.id) {
        existing.reactedByUser = true;
      }
      messageGroup[normalizedEmoji] = existing;
    });

    const mapped: Record<string, ReactionSummary[]> = {};
    Object.keys(grouped).forEach((messageId) => {
      mapped[messageId] = Object.values(grouped[messageId]);
    });
    setReactionsByMessage(mapped);
  }, [messages, user]);

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    if (!isSingleEmoji(emoji)) {
      toast({ title: 'Invalid reaction', description: 'Please select a valid emoji.' });
      return;
    }
    const targetMessage = messages.find((message) => message.id === messageId);
    if (!targetMessage || targetMessage.retracted_at) return;
    const currentReactions = reactionsByMessage[messageId] || [];
    const alreadyReacted = currentReactions.some(
      reaction => reaction.emoji === emoji && reaction.reactedByUser
    );

    await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', user.id);

    if (!alreadyReacted) {
      await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: user.id,
          emoji,
        });
    }

    await fetchReactions();
    setReactionBar(null);
  };

  const handleCustomEmoji = async () => {
    if (!emojiPickerMessageId) return;
    const value = customEmoji.trim();
    if (!isSingleEmoji(value)) {
      toast({ title: 'Invalid emoji', description: 'Pick a single emoji.' });
      return;
    }
    await toggleReaction(emojiPickerMessageId, value);
    setCustomEmoji('');
    setEmojiPickerMessageId(null);
  };

  const closeMessageMenus = (keepMessage = false) => {
    setContextMenuPos(null);
    setActionSheetOpen(false);
    if (!keepMessage) {
      setActionMessage(null);
    }
  };

  const openMessageMenu = (message: Message, mode: 'sheet' | 'context', position?: { x: number; y: number }) => {
    setActionMessage(message);
    if (mode === 'context') {
      setContextMenuPos(position || { x: 0, y: 0 });
      setActionSheetOpen(false);
    } else {
      setActionSheetOpen(true);
      setContextMenuPos(null);
    }
  };

  const handleMessagePointerDown = (message: Message, event: ReactPointerEvent) => {
    if (event.pointerType !== 'touch') return;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    longPressTriggeredRef.current = false;
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setActionMessage(message);
      openReactionBar(message);
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    }, 450);
  };

  const handleMessagePointerMove = (event: ReactPointerEvent) => {
    if (!pointerStartRef.current || !longPressTimerRef.current) return;
    const dx = event.clientX - pointerStartRef.current.x;
    const dy = event.clientY - pointerStartRef.current.y;
    if (Math.hypot(dx, dy) > 12) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleMessagePointerEnd = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pointerStartRef.current = null;
  };

  const openReactionBar = (message: Message) => {
    const node = messageRefs.current[message.id];
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const desiredY = rect.top - 52;
    const y = desiredY < 8 ? rect.bottom + 8 : desiredY;
    const x = Math.min(window.innerWidth - 40, Math.max(40, centerX));
    setReactionBar({ messageId: message.id, x, y });
    if (navigator.vibrate) {
      navigator.vibrate(8);
    }
  };

  useEffect(() => {
    if (!reactionBar) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!reactionBarRef.current) return;
      if (reactionBarRef.current.contains(event.target as Node)) return;
      setReactionBar(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setReactionBar(null);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [reactionBar]);

  const removeEventFromCrew = async (message: Message) => {
    if (!groupId || !message.attached_event_id) return;
    await removeCrewEventFromCrew(groupId, message.attached_event_id);
    refreshCrewPins(messageEventIdsRef.current);
    toast({ title: 'Event removed from crew' });
    closeMessageMenus();
  };

  const handleMessageContextMenu = (message: Message, event: ReactMouseEvent) => {
    event.preventDefault();
    openReactionBar(message);
  };

  const getMessageMenuItems = (message: Message) => {
    const isOwnMessage = message.user_id === user?.id;
    const isTextMessage = message.message_type === 'text';
    const isRetracted = Boolean(message.retracted_at);
    const isEventMessage = Boolean(message.attached_event_id) || message.message_type === 'event';
    const currentRole = members.find((member) => member.user_id === user?.id)?.role || '';
    const canManageEvents = isEventMessage && (isOwnMessage || currentRole === 'owner' || currentRole === 'admin');

    return [
      {
        key: 'reply',
        label: 'Reply',
        icon: Reply,
        onClick: () => handleReply(message),
      },
      {
        key: 'react',
        label: 'React',
        icon: Smile,
        onClick: () => {
          if (isRetracted) return;
          openReactionBar(message);
          closeMessageMenus();
        },
        hidden: isRetracted,
      },
      {
        key: 'edit',
        label: 'Edit',
        icon: Pencil,
        onClick: () => handleEdit(message),
        hidden: !isOwnMessage || !isTextMessage || isRetracted,
      },
      {
        key: 'copy',
        label: 'Copy',
        icon: Copy,
        onClick: () => handleCopyMessage(message),
        hidden: !message.text,
      },
      {
        key: 'remove_event',
        label: 'Remove from Events',
        icon: Trash2,
        onClick: () => removeEventFromCrew(message),
        hidden: !canManageEvents,
        destructive: true,
      },
      {
        key: 'retract',
        label: 'Retract',
        icon: Trash2,
        onClick: () => {
          setConfirmRetractOpen(true);
          closeMessageMenus(true);
        },
        hidden: !isOwnMessage || isRetracted,
        destructive: true,
      },
    ].filter((item) => !item.hidden);
  };

  const handleCopyMessage = async (message: Message) => {
    if (!message.text) return;
    await navigator.clipboard.writeText(message.text);
    toast({ title: 'Copied' });
    closeMessageMenus();
  };

  const handleReply = (message: Message) => {
    setReplyToMessageId(message.id);
    closeMessageMenus();
  };

  const handleEdit = (message: Message) => {
    if (!message.text || message.retracted_at) return;
    setEditingMessageId(message.id);
    setEditText(message.text);
    closeMessageMenus();
  };

  const saveEdit = async (message: Message) => {
    if (!editText.trim() || message.retracted_at) return;
    const { error } = await supabase
      .from('messages')
      .update({
        text: editText.trim(),
        edited_at: new Date().toISOString(),
      })
      .eq('id', message.id);

    if (error) {
      toast({
        title: 'Unable to edit message',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    setEditingMessageId(null);
    setEditText('');
    fetchMessages();
  };

  const handleRetract = async (message: Message) => {
    if (!user) return;
    const now = new Date();
    const ttlSeconds = getRetractTtlSeconds();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
    const { error } = await supabase
      .from('messages')
      .update({
        is_retracted: true,
        retracted_at: now.toISOString(),
        expires_at: expiresAt,
        retracted_by: user.id,
        text: null,
        attached_event_id: null,
      })
      .eq('id', message.id);

    if (!error) {
      await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', message.id);
      if (message.attached_event_id && groupId) {
        await removeCrewEventFromCrew(groupId, message.attached_event_id);
        refreshCrewPins(messageEventIdsRef.current);
      }
      toast({ title: 'Message retracted' });
      fetchMessages();
      fetchReactions();
    } else {
      toast({
        title: 'Unable to retract',
        description: error.message,
        variant: 'destructive',
      });
    }
    setConfirmRetractOpen(false);
    closeMessageMenus();
  };

  const fetchMembers = useCallback(async () => {
    if (!groupId) return;
    const { data } = await supabase.rpc('get_group_members', { p_group_id: groupId });
    if (data) {
      const memberRows = (data || []) as GroupMemberRow[];
      setMembers(memberRows.map((m) => ({
        ...m,
        name: m.name,
        avatar_url: m.avatar_url,
      })));
    }
  }, [groupId]);

  const fetchReadReceipts = useCallback(async () => {
    if (!groupId) return;
    const { data } = await supabase
      .from('group_reads')
      .select('user_id, last_read_at')
      .eq('group_id', groupId);

    const next: Record<string, string> = {};
    (data || []).forEach((row) => {
      if (row.last_read_at) {
        next[row.user_id] = row.last_read_at;
      }
    });
    setGroupReads(next);
  }, [groupId]);

  const updateReadReceipt = useCallback(async () => {
    if (!user || !groupId || messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;
    await supabase
      .from('group_reads')
      .upsert({
        group_id: groupId,
        user_id: user.id,
        last_read_message_id: lastMessage.id,
        last_read_at: new Date().toISOString(),
      });
  }, [groupId, messages, user]);

  const refreshCrewPins = useCallback(async (eventIds: string[]) => {
    if (!user || !groupId) return;
    if (eventIds.length === 0) {
      setCrewPinCounts({});
      setCrewPinNames({});
      setCrewPinnedByUser(new Set());
      return;
    }
    const [counts, pinnedByUser] = await Promise.all([
      getCrewEventPinCounts(groupId, eventIds),
      getCrewEventPinsForUser(groupId, eventIds, user.id),
    ]);
    setCrewPinCounts(counts);
    setCrewPinnedByUser(pinnedByUser);

    const { data: pins } = await supabase
      .from('crew_event_pins')
      .select('event_id, user_id')
      .eq('crew_id', groupId)
      .in('event_id', Array.from(new Set(eventIds)));
    const userIds = Array.from(new Set((pins || []).map((pin) => pin.user_id)));
    const { data: profiles } = userIds.length > 0
      ? await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', userIds)
      : { data: [] as Array<{ user_id: string; name: string | null }> };
    const nameByUser = new Map((profiles || []).map((profile) => [profile.user_id, profile.name || 'Someone']));
    const namesByEvent: Record<string, string[]> = {};
    (pins || []).forEach((pin) => {
      if (!namesByEvent[pin.event_id]) namesByEvent[pin.event_id] = [];
      namesByEvent[pin.event_id].push(nameByUser.get(pin.user_id) || 'Someone');
    });
    setCrewPinNames(namesByEvent);
  }, [groupId, user]);

  const fetchCrewPinnedEvents = useCallback(async (pinsRequired: number = requiredPins) => {
    if (!groupId) return;
    const events = await getCrewPinnedEvents(groupId, pinsRequired);
    setCrewBoardEvents(events);
    const eventIds = events.map((event) => event.supabaseId).filter((eventId): eventId is string => Boolean(eventId));
    refreshCrewPins(eventIds);
  }, [groupId, refreshCrewPins, requiredPins]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (user && groupId) {
      fetchGroup();
      fetchMessages();
      fetchMembers();
      fetchCrewPinnedEvents();

      // Set up realtime subscription
      const channel = supabase
        .channel(`group-${groupId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `group_id=eq.${groupId}`,
          },
          async (payload) => {
            if (payload.eventType === 'DELETE') {
              const oldMsg = payload.old as { id?: string } | null;
              if (!oldMsg?.id) return;
              setMessages(prev => prev.filter((message) => message.id !== oldMsg.id));
              setReactionsByMessage(prev => {
                const next = { ...prev };
                delete next[oldMsg.id];
                return next;
              });
              return;
            }

            const nextMsg = payload.new as Message;
            if (!nextMsg) return;
            const profile = nextMsg.user_id
              ? (await supabase
                  .from('profiles')
                  .select('name, avatar_url')
                  .eq('user_id', nextMsg.user_id)
                  .single()).data
              : null;

            let attachedEvent = undefined;
            if (nextMsg.attached_event_id) {
              const { data: eventData } = await supabase
                .from('events')
                .select('id, name, venue_name, city, start_datetime, end_datetime, image_url, event_type')
                .eq('id', nextMsg.attached_event_id)
                .single();
              if (eventData) {
                attachedEvent = eventData;
              }
            }

            setMessages(prev => {
              const existingIndex = prev.findIndex((message) => message.id === nextMsg.id);
              const mapped = {
                ...nextMsg,
                sender_name: profile?.name || 'Unknown',
                sender_avatar: profile?.avatar_url,
                attached_event: attachedEvent,
              };
              if (existingIndex === -1) {
                return [...prev, mapped];
              }
              const next = [...prev];
              next[existingIndex] = mapped;
              return next;
            });
          }
        )
        .subscribe();

      const presenceChannel = supabase
        .channel(`presence-group-${groupId}`, {
          config: {
            presence: { key: user.id },
          },
        })
        .on('presence', { event: 'sync' }, () => {
          const state = presenceChannel.presenceState();
          const online = new Set<string>();
          Object.keys(state).forEach((key) => online.add(key));
          setOnlineUsers(online);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await presenceChannel.track({ online_at: new Date().toISOString() });
          }
        });

      let activeIntervalId: number | null = null;
      const activeChannel = supabase
        .channel(`presence-active-${groupId}`, {
          config: {
            presence: { key: `${user.id}-active` },
          },
        })
        .on('presence', { event: 'sync' }, () => {
          const state = activeChannel.presenceState();
          const active = new Set<string>();
          Object.keys(state).forEach((key) => {
            const userId = key.replace('-active', '');
            if (userId) active.add(userId);
          });
          setActiveUsers(active);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await activeChannel.track({ active_at: new Date().toISOString() });
            activeIntervalId = window.setInterval(() => {
              activeChannel.track({ active_at: new Date().toISOString() });
            }, 20000);
          }
        });

      const pinChannel = supabase
        .channel(`crew-pins-${groupId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'crew_event_pins',
            filter: `crew_id=eq.${groupId}`,
          },
          () => {
            refreshCrewPins(messageEventIdsRef.current);
          }
        )
        .subscribe();

      const membersChannel = supabase
        .channel(`group-members-${groupId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'group_members',
            filter: `group_id=eq.${groupId}`,
          },
          () => {
            fetchMembers();
          }
        )
        .subscribe();

      const typingChannel = supabase
        .channel(`typing-${groupId}`, {
          config: { broadcast: { self: false } },
        })
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          const userId = payload?.user_id as string | undefined;
          const isTyping = payload?.typing as boolean | undefined;
          if (!userId) return;
          setTypingUsers((prev) => {
            const next = { ...prev };
            if (isTyping) {
              next[userId] = Date.now() + 2500;
            } else {
              delete next[userId];
            }
            return next;
          });
        })
        .subscribe();
      typingChannelRef.current = typingChannel;

      const readsChannel = supabase
        .channel(`group-reads-${groupId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'group_reads',
            filter: `group_id=eq.${groupId}`,
          },
          () => {
            fetchReadReceipts();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(presenceChannel);
        supabase.removeChannel(activeChannel);
        supabase.removeChannel(pinChannel);
        supabase.removeChannel(membersChannel);
        supabase.removeChannel(typingChannel);
        supabase.removeChannel(readsChannel);
        if (activeIntervalId) window.clearInterval(activeIntervalId);
      };
    }
  }, [
    fetchCrewPinnedEvents,
    fetchGroup,
    fetchMembers,
    fetchMessages,
    fetchReadReceipts,
    groupId,
    refreshCrewPins,
    user,
  ]);

  useEffect(() => {
    if (!user || !groupId) return;
    runRetractedCleanup();
    const intervalId = window.setInterval(runRetractedCleanup, 60000);
    return () => window.clearInterval(intervalId);
  }, [groupId, runRetractedCleanup, user]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTypingUsers((prev) => {
        const next: Record<string, number> = {};
        Object.keys(prev).forEach((userId) => {
          if (prev[userId] > Date.now()) {
            next[userId] = prev[userId];
          }
        });
        return next;
      });
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const eventIds = messages
      .map(message => message.attached_event_id)
      .filter((eventId): eventId is string => Boolean(eventId));
    messageEventIdsRef.current = eventIds;
    if (user && groupId) {
      refreshCrewPins(eventIds);
    }
  }, [groupId, messages, refreshCrewPins, user]);

  useEffect(() => {
    if (messages.length > 0) {
      fetchReactions();
      updateReadReceipt();
      fetchReadReceipts();
    } else {
      setReactionsByMessage({});
    }
  }, [fetchReadReceipts, fetchReactions, messages, updateReadReceipt]);

  // Keep the scroll padding in sync with the fixed composer height.
  useEffect(() => {
    const root = groupChatRef.current;
    const composer = composerRef.current;
    if (!root || !composer) return;

    const updateHeight = () => {
      root.style.setProperty('--composer-height', `${composer.offsetHeight}px`);
    };

    updateHeight();
    const observer = new ResizeObserver(() => updateHeight());
    observer.observe(composer);
    window.addEventListener('resize', updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  useEffect(() => {
    if (!groupId || messages.length === 0) return;
    const messageIds = messages.map((message) => message.id);
    if (messageIds.length === 0) return;
    const filter = `message_id=in.(${messageIds.join(',')})`;
    const reactionsChannel = supabase
      .channel(`message-reactions-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
          filter,
        },
        () => {
          fetchReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reactionsChannel);
    };
  }, [fetchReactions, groupId, messages]);

  const toggleCrewPin = async (eventId: string) => {
    if (!user || !groupId) return;
    const wasPinned = crewPinnedByUser.has(eventId);
    const previousPinned = new Set(crewPinnedByUser);
    const previousCounts = { ...crewPinCounts };
    const nextPinned = new Set(crewPinnedByUser);
    const nextCounts = { ...crewPinCounts };

    if (wasPinned) {
      nextPinned.delete(eventId);
      nextCounts[eventId] = Math.max(0, (nextCounts[eventId] || 1) - 1);
    } else {
      nextPinned.add(eventId);
      nextCounts[eventId] = (nextCounts[eventId] || 0) + 1;
    }

    setCrewPinnedByUser(nextPinned);
    setCrewPinCounts(nextCounts);

    const { error } = wasPinned
      ? await unpinCrewEvent(groupId, eventId, user.id)
      : await pinCrewEvent(groupId, eventId, user.id);

    if (error) {
      setCrewPinnedByUser(previousPinned);
      setCrewPinCounts(previousCounts);
      toast({
        title: 'Unable to update pin',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: wasPinned ? 'Pin removed' : 'Pinned',
    });
    refreshCrewPins(messageEventIdsRef.current);
    fetchCrewPinnedEvents();
  };

  const sendMessage = async () => {
    if (!user || !groupId || !newMessage.trim()) return;
    setSending(true);
    const userName = getDisplayName(user);
    typingChannelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: user.id, user_name: userName, typing: false },
    });

    const { error } = await supabase
      .from('messages')
      .insert({
        group_id: groupId,
        user_id: user.id,
        text: newMessage.trim(),
        message_type: 'text',
        reply_to_message_id: replyToMessageId,
      });

    if (!error) {
      setNewMessage('');
      setReplyToMessageId(null);
    }
    setSending(false);
  };

  const inviteByUsername = async () => {
    if (!user || !groupId || !inviteUsername.trim()) return;
    setInviting(true);
    const { error } = await supabase.rpc('invite_user_to_group', {
      p_group_id: groupId,
      p_username: inviteUsername.trim().toLowerCase(),
    });

    if (error) {
      toast({
        title: 'Invite failed',
        description: error.message,
        variant: 'destructive',
      });
      setInviting(false);
      return;
    }

    toast({
      title: 'Invite sent',
      description: `Added ${inviteUsername.trim()} to the crew.`,
    });
    setInviteUsername('');
    setInviting(false);
    fetchMembers();
  };

  const messageMenuItems = actionMessage ? getMessageMenuItems(actionMessage) : [];
  const replyMessage = replyToMessageId
    ? messages.find((message) => message.id === replyToMessageId)
    : null;
  const onlineCount = Array.from(onlineUsers).filter((id) => id !== user?.id).length;
  const lastMessageByCurrentUser = [...messages].reverse().find((message) => message.user_id === user?.id);
  const seenCount = lastMessageByCurrentUser
    ? Object.entries(groupReads).filter(([userId, lastReadAt]) => {
        if (userId === user?.id) return false;
        return new Date(lastReadAt).getTime() >= new Date(lastMessageByCurrentUser.created_at).getTime();
      }).length
    : 0;

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
    <div ref={groupChatRef} className="group-chat gradient-bg">
      {/* Header */}
      <div className="group-chat__header glass border-b border-border/50">
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
                {group.city && ` - ${group.city}`}
                {onlineCount > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 text-emerald-400">
                    <span className="presence-dot presence-dot--inline" />
                    {onlineCount > 1 ? `${onlineCount} online` : 'Active now'}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="chat" className="flex-1 flex flex-col min-h-0">
        <div className="group-chat__tabs bg-transparent">
          <div className="max-w-lg mx-auto w-full px-4 pb-2">
            <TabsList className="w-full bg-muted">
              <TabsTrigger value="chat" className="flex-1">Chat</TabsTrigger>
              <TabsTrigger value="events" className="flex-1">Events</TabsTrigger>
              <TabsTrigger value="members" className="flex-1">Members</TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Chat Tab */}
        <TabsContent value="chat" className="flex-1 flex flex-col m-0">
          <div className="group-chat__messages flex-1 min-h-0 overflow-y-auto max-w-lg mx-auto w-full px-4 py-4">
            {messages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No crew chat yet.</p>
                <p className="mt-1 text-xs">Share an event from the feed to start planning together.</p>
              </div>
            ) : (
              messages.map((message) => {
                const replyTarget = message.reply_to_message_id
                  ? messages.find((item) => item.id === message.reply_to_message_id)
                  : null;
                const replyPreview = message.reply_to_message_id ? {
                  text: replyTarget
                    ? (replyTarget.text || 'Shared an event')
                    : 'Original message was retracted',
                  senderName: replyTarget?.sender_name,
                  isRetracted: Boolean(replyTarget?.retracted_at || replyTarget?.is_retracted || !replyTarget),
                } : undefined;
                const readReceipt = lastMessageByCurrentUser?.id === message.id
                  ? seenCount > 0
                    ? `Seen by ${seenCount}`
                    : 'Sent'
                  : undefined;
                return (
                  <div
                    key={message.id}
                    ref={(node) => { messageRefs.current[message.id] = node; }}
                    onContextMenu={(event) => handleMessageContextMenu(message, event)}
                    onPointerDown={(event) => handleMessagePointerDown(message, event)}
                    onPointerMove={handleMessagePointerMove}
                    onPointerUp={handleMessagePointerEnd}
                    onPointerCancel={handleMessagePointerEnd}
                  >
                    {editingMessageId === message.id ? (
                      <div className={message.user_id === user?.id ? 'message-bubble sent' : 'message-bubble received'}>
                        <Textarea
                          value={editText}
                          onChange={(event) => setEditText(event.target.value)}
                          className="bg-muted border-border/50 text-sm"
                        />
                        <div className="flex gap-2 mt-2 justify-end">
                          <Button variant="outline" size="sm" onClick={() => {
                            setEditingMessageId(null);
                            setEditText('');
                          }}>
                            Cancel
                          </Button>
                          <Button variant="neon" size="sm" onClick={() => saveEdit(message)}>
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <MessageBubble
                        text={message.text || undefined}
                        senderName={message.sender_name}
                        senderAvatar={message.sender_avatar || undefined}
                        timestamp={message.created_at}
                        isSent={message.user_id === user?.id}
                        messageType={message.message_type || 'text'}
                        isRetracted={Boolean(message.retracted_at || message.is_retracted)}
                        editedAt={message.edited_at}
                        replyPreview={replyPreview}
                        onReplyPreviewClick={() => {
                          if (replyTarget?.id) {
                            messageRefs.current[replyTarget.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          } else if (message.reply_to_message_id) {
                            toast({ title: 'Original message removed' });
                          }
                        }}
                        reactions={reactionsByMessage[message.id] || []}
                        onToggleReaction={(emoji) => toggleReaction(message.id, emoji)}
                        onReactClick={() => openReactionBar(message)}
                        attachedEvent={message.attached_event ? {
                          id: message.attached_event.id,
                          name: message.attached_event.name,
                          venueName: message.attached_event.venue_name || undefined,
                          city: message.attached_event.city || undefined,
                          startDatetime: message.attached_event.start_datetime,
                          endDatetime: message.attached_event.end_datetime || undefined,
                          imageUrl: message.attached_event.image_url || undefined,
                          eventType: message.attached_event.event_type || undefined,
                        } : undefined}
                        onViewEvent={() => message.attached_event && navigate(`/events/${message.attached_event.id}`)}
                        isPinned={
                          message.attached_event
                            ? crewPinnedByUser.has(message.attached_event.id)
                            : false
                        }
                        onTogglePin={
                          message.attached_event
                            ? () => toggleCrewPin(message.attached_event.id)
                            : undefined
                        }
                        pinCount={
                          message.attached_event
                            ? crewPinCounts[message.attached_event.id] || 0
                            : 0
                        }
                        requiredPins={requiredPins}
                        readReceipt={readReceipt}
                      />
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div ref={composerRef} className="group-chat__composer glass border-t border-border/50 p-4">
            <div className="max-w-lg mx-auto flex gap-2">
              <div className="flex-1">
                {Object.keys(typingUsers).filter((id) => id !== user?.id && typingUsers[id] > Date.now()).length > 0 && (
                  <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                    {(() => {
                      const typers = Object.keys(typingUsers)
                        .filter((id) => id !== user?.id && typingUsers[id] > Date.now())
                        .map((id) => members.find((member) => member.user_id === id)?.name || 'Someone');
                      if (typers.length === 1) return `${typers[0]} is typing`;
                      if (typers.length > 1) return `${typers[0]} + ${typers.length - 1} more are typing`;
                      return null;
                    })()}
                    <div className="typing-indicator" aria-hidden="true">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  </div>
                )}
                {(replyMessage || replyToMessageId) && (
                  <div className="mb-2 rounded-lg border border-border/60 bg-muted/60 px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
                    <div className="truncate">
                      {replyMessage
                        ? `Replying to ${replyMessage.sender_name}: ${replyMessage.retracted_at || replyMessage.is_retracted ? 'Original message was retracted' : (replyMessage.text || 'Shared an event')}`
                        : 'Replying to: Original message was retracted'}
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyToMessageId(null)}
                      className="ml-2 text-muted-foreground hover:text-foreground"
                    >
                      x
                    </button>
                  </div>
                )}
                <Input
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    if (!user) return;
                    const userName = getDisplayName(user);
                    typingChannelRef.current?.send({
                      type: 'broadcast',
                      event: 'typing',
                      payload: { user_id: user.id, user_name: userName, typing: true },
                    });
                    if (typingTimeoutRef.current) {
                      window.clearTimeout(typingTimeoutRef.current);
                    }
                    typingTimeoutRef.current = window.setTimeout(() => {
                      typingChannelRef.current?.send({
                        type: 'broadcast',
                        event: 'typing',
                        payload: { user_id: user.id, user_name: userName, typing: false },
                      });
                    }, 2000);
                  }}
                  onBlur={() => {
                    const userName = getDisplayName(user);
                    typingChannelRef.current?.send({
                      type: 'broadcast',
                      event: 'typing',
                      payload: { user_id: user?.id, user_name: userName, typing: false },
                    });
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  className="bg-muted border-border/50"
                />
              </div>
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
          <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
            {crewBoardEvents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No crew plan yet.</p>
                <p className="mt-1 text-xs">Pin or vote for shared events in chat. Events that reach the crew threshold become Crew Picks.</p>
              </div>
            ) : (
              crewBoardEvents.map((event) => {
                const eventId = event.supabaseId || event.id;
                const pinCount = event.supabaseId ? crewPinCounts[event.supabaseId] || 0 : 0;
                const voters = event.supabaseId ? crewPinNames[event.supabaseId] || [] : [];
                return (
                  <div key={event.externalId || event.id} className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{getPlanningStatus(pinCount)}</span>
                      <span>{pinCount}/{requiredPins} votes</span>
                      {voters.length > 0 && <span>Voted by {voters.join(', ')}</span>}
                    </div>
                    <EventCard
                      id={eventId}
                      name={event.name}
                      venueName={event.venueName}
                      city={event.city}
                      startDatetime={event.startDateTime}
                      endDatetime={event.endDateTime}
                      minPrice={event.minPrice}
                      imageUrl={event.imageUrl}
                      eventType={event.eventType}
                      genres={event.genres}
                      matchReason={getPlanningStatus(pinCount)}
                      onView={() => event.supabaseId && navigate(`/events/${event.supabaseId}`)}
                    />
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="flex-1 m-0">
          <div className="max-w-lg mx-auto px-4 py-4 space-y-2">
            <div className="card-neon rounded-xl border border-border/50 p-4">
              <h3 className="font-display font-semibold mb-2">Invite by username</h3>
              <div className="flex gap-2">
                <Input
                  value={inviteUsername}
                  onChange={(event) => setInviteUsername(event.target.value)}
                  placeholder="username"
                  className="flex-1 bg-muted border-border/50"
                />
                <Button
                  onClick={inviteByUsername}
                  disabled={!inviteUsername.trim() || inviting}
                  variant="neon"
                >
                  {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Invite'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Only owners/admins can invite.
              </p>
            </div>
            {members.map((member) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-neon rounded-xl border border-border/50 p-3 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-muted overflow-hidden flex-shrink-0 relative">
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt={member.name || ''} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-medium text-muted-foreground">
                      {(member.name || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  {(activeUsers.has(member.user_id) || onlineUsers.has(member.user_id)) && (
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-background ${
                        activeUsers.has(member.user_id)
                          ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]'
                          : 'bg-emerald-400/70'
                      }`}
                    />
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

      {reactionBar && (
        <div
          ref={reactionBarRef}
          className="reaction-bar"
          style={{ left: `${reactionBar.x}px`, top: `${reactionBar.y}px` }}
        >
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                if (navigator.vibrate) {
                  navigator.vibrate(6);
                }
                toggleReaction(reactionBar.messageId, emoji);
              }}
              className="reaction-bar__item"
            >
              {emoji}
            </button>
          ))}
          <button
            type="button"
            className="reaction-bar__item"
            onClick={() => {
              setEmojiPickerMessageId(reactionBar.messageId);
              setReactionBar(null);
            }}
            aria-label="More reactions"
          >
            +
          </button>
          <button
            type="button"
            className="reaction-bar__item"
            onClick={() => {
              const target = messages.find((message) => message.id === reactionBar.messageId);
              if (!target) return;
              setReactionBar(null);
              openMessageMenu(target, 'context', {
                x: Math.max(12, reactionBar.x - 110),
                y: reactionBar.y + 44,
              });
            }}
            aria-label="Message actions"
          >
            ⋯
          </button>
        </div>
      )}

      {contextMenuPos && actionMessage && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => closeMessageMenus()}
          onContextMenu={(event) => {
            event.preventDefault();
            closeMessageMenus();
          }}
        >
          <div
            className="fixed card-neon border border-border/60 rounded-lg bg-card/95 backdrop-blur-sm shadow-lg p-2 w-[210px]"
            style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
            onClick={(event) => event.stopPropagation()}
          >
            {messageMenuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted/40 flex items-center gap-2${item.destructive ? ' text-destructive hover:bg-destructive/10' : ''}`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {actionSheetOpen && actionMessage && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => closeMessageMenus()} />
          <div className="absolute bottom-0 left-0 right-0 card-neon border border-border/60 rounded-t-2xl bg-card/95 backdrop-blur-sm p-4 space-y-3">
            {messageMenuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick}
                  className={`w-full text-left px-4 py-3 rounded-lg text-sm hover:bg-muted/30 flex items-center gap-2${item.destructive ? ' text-destructive hover:bg-destructive/10' : ''}`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => closeMessageMenus()}
              className="w-full text-left px-4 py-3 rounded-lg text-sm text-muted-foreground hover:bg-muted/30"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <Dialog open={confirmRetractOpen} onOpenChange={setConfirmRetractOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">Retract message for everyone?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will remove the message for everyone in the crew.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmRetractOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => actionMessage && handleRetract(actionMessage)}
              >
                Retract
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(emojiPickerMessageId)} onOpenChange={(open) => {
        if (!open) {
          setEmojiPickerMessageId(null);
          setCustomEmoji('');
        }
      }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">Add reaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pick a single emoji using your keyboard.
            </p>
            <Input
              value={customEmoji}
              onChange={(event) => setCustomEmoji(event.target.value)}
              placeholder="😀"
              className="bg-muted border-border/50 text-center text-2xl"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => {
                setEmojiPickerMessageId(null);
                setCustomEmoji('');
              }}>
                Cancel
              </Button>
              <Button variant="neon" className="flex-1" onClick={handleCustomEmoji}>
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
