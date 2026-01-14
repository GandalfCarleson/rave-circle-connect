import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Calendar, Ticket, Users, Check, Heart, CalendarPlus, Send } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { GenreChip } from '@/components/GenreChip';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Event {
  id: string;
  name: string;
  description: string | null;
  venue_name: string | null;
  city: string | null;
  start_datetime: string;
  end_datetime: string | null;
  min_price: number | null;
  ticket_url: string | null;
  image_url: string | null;
  event_type: string | null;
  genres: string[];
}

type EventStatus = 'going' | 'interested' | 'ignored' | null;

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<EventStatus>(null);
  const [goingCount, setGoingCount] = useState(0);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [userGroups, setUserGroups] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchEvent();
      fetchStatus();
      fetchGoingCount();
      fetchUserGroups();
    }
  }, [user, id]);

  const fetchEvent = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();
    
    if (data) setEvent(data);
    setLoading(false);
  };

  const fetchStatus = async () => {
    if (!user || !id) return;
    const { data } = await supabase
      .from('user_event_statuses')
      .select('status')
      .eq('user_id', user.id)
      .eq('event_id', id)
      .single();
    
    if (data) setStatus(data.status as EventStatus);
  };

  const fetchGoingCount = async () => {
    if (!id) return;
    const { count } = await supabase
      .from('user_event_statuses')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', id)
      .eq('status', 'going');
    
    setGoingCount(count || 0);
  };

  const fetchUserGroups = async () => {
    if (!user) return;
    const { data: memberGroups } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id);

    if (memberGroups && memberGroups.length > 0) {
      const groupIds = memberGroups.map((member) => member.group_id);
      const { data: groups } = await supabase
        .from('groups')
        .select('id, name')
        .in('id', groupIds);
      if (groups) setUserGroups(groups);
    }
  };

  const shareToGroup = async () => {
    if (!user || !event || !selectedGroupId) return;
    const { error } = await supabase
      .from('messages')
      .insert({
        group_id: selectedGroupId,
        user_id: user.id,
        text: null,
        attached_event_id: event.id,
        message_type: 'event',
      });

    if (!error) {
      const groupName = userGroups.find(group => group.id === selectedGroupId)?.name;
      toast({
        title: 'Sent',
        description: groupName ? `Sent to ${groupName}` : 'Event sent to your crew.',
      });
      setSelectedGroupId(null);
      setShareModalOpen(false);
    } else {
      toast({
        title: 'Failed to share',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const updateStatus = async (newStatus: 'going' | 'interested') => {
    if (!user || !id) return;

    const { error } = await supabase
      .from('user_event_statuses')
      .upsert({
        user_id: user.id,
        event_id: id,
        status: newStatus,
      });

    if (!error) {
      setStatus(newStatus);
      toast({
        title: newStatus === 'going' ? "You're going!" : "Marked as interested",
        description: newStatus === 'going' 
          ? 'See you there!' 
          : "We'll remind you about this event",
      });
      fetchGoingCount();
    }
  };

  const generateICS = () => {
    if (!event) return;

    const startDate = new Date(event.start_datetime);
    const endDate = event.end_datetime ? new Date(event.end_datetime) : new Date(startDate.getTime() + 4 * 60 * 60 * 1000);

    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//RaveCircle//Event//EN
BEGIN:VEVENT
UID:${event.id}@ravecircle.app
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${event.name}
DESCRIPTION:${event.description || ''}
LOCATION:${event.venue_name || ''}, ${event.city || ''}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `${event.name.replace(/\s+/g, '_')}.ics`;
    link.click();

    toast({
      title: 'Calendar file downloaded',
      description: 'Add it to your calendar app',
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <p className="text-muted-foreground">Event not found</p>
      </div>
    );
  }

  const eventDate = new Date(event.start_datetime);

  return (
    <div className="min-h-screen gradient-bg">
      {/* Hero Image */}
      <div className="relative h-72 overflow-hidden">
        {event.image_url ? (
          <img
            src={event.image_url}
            alt={event.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
            <Calendar className="w-20 h-20 text-primary/30" />
          </div>
        )}
        <div className="event-image-overlay absolute inset-0" />
        
        {/* Back button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 bg-card/80 backdrop-blur-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        {/* Event type badge */}
        {event.event_type && (
          <span className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-primary/90 text-primary-foreground text-sm font-medium capitalize">
            {event.event_type}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6 -mt-16 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-neon rounded-2xl border border-border/50 p-6"
        >
          <h1 className="font-display font-bold text-2xl mb-2">{event.name}</h1>

          {/* Venue & Location */}
          <div className="flex items-center gap-2 text-muted-foreground mb-4">
            <MapPin className="w-4 h-4" />
            <span>
              {event.venue_name && `${event.venue_name}, `}{event.city}
            </span>
          </div>

          {/* Date & Time */}
          <div className="flex items-center gap-2 text-primary font-medium mb-4">
            <Calendar className="w-4 h-4" />
            <span>
              {format(eventDate, 'EEEE, MMMM d, yyyy')} • {format(eventDate, 'HH:mm')}
            </span>
          </div>

          {/* Price */}
          {event.min_price && (
            <div className="flex items-center gap-2 text-secondary font-medium mb-4">
              <Ticket className="w-4 h-4" />
              <span>From {event.min_price} kr</span>
            </div>
          )}

          {/* Going count */}
          <div className="flex items-center gap-2 text-muted-foreground mb-6">
            <Users className="w-4 h-4" />
            <span>{goingCount} people going</span>
          </div>

          {/* Genres */}
          {event.genres && event.genres.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {event.genres.map(genre => (
                <GenreChip key={genre} genre={genre} />
              ))}
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="mb-6">
              <h3 className="font-display font-semibold mb-2">About</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {event.description}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                onClick={() => updateStatus('going')}
                variant={status === 'going' ? 'neon' : 'outline'}
                className="flex-1"
              >
                {status === 'going' ? (
                  <>
                    <Check className="w-4 h-4" />
                    Going
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    I'm Going
                  </>
                )}
              </Button>
              <Button
                onClick={() => updateStatus('interested')}
                variant={status === 'interested' ? 'neon-cyan' : 'outline'}
                className="flex-1"
              >
                {status === 'interested' ? (
                  <>
                    <Heart className="w-4 h-4 fill-current" />
                    Interested
                  </>
                ) : (
                  <>
                    <Heart className="w-4 h-4" />
                    Interested
                  </>
                )}
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={generateICS}
                variant="outline"
                className="flex-1"
              >
                <CalendarPlus className="w-4 h-4" />
                Add to Calendar
              </Button>
              <Button
                onClick={() => {
                  setSelectedGroupId(null);
                  setShareModalOpen(true);
                }}
                variant="outline"
                className="flex-1"
              >
                <Send className="w-4 h-4" />
                Share to Group
              </Button>
            </div>

            {event.ticket_url && (
              <Button
                onClick={() => window.open(event.ticket_url!, '_blank')}
                variant="neon"
                size="lg"
                className="w-full"
              >
                <Ticket className="w-4 h-4" />
                Get Tickets
              </Button>
            )}
          </div>
        </motion.div>
      </div>

      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">Send to crew</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {userGroups.length === 0 ? (
              <>
                <p className="text-muted-foreground text-sm text-center">
                  You haven't joined any crews yet
                </p>
                <Button
                  className="w-full mt-4"
                  variant="neon"
                  onClick={() => {
                    setShareModalOpen(false);
                    navigate('/groups');
                  }}
                >
                  Create a Crew
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  {userGroups.map(group => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => setSelectedGroupId(group.id)}
                      className={`w-full p-3 rounded-lg border text-left transition-colors ${
                        selectedGroupId === group.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <p className="font-medium">{group.name}</p>
                    </button>
                  ))}
                </div>
                <Button
                  onClick={shareToGroup}
                  disabled={!selectedGroupId}
                  className="w-full mt-4"
                  variant="neon"
                >
                  Send
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
