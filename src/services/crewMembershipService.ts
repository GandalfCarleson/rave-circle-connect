import { supabase } from '@/integrations/supabase/client';

export async function leaveCrew(crewId: string, userId: string) {
  return supabase
    .from('group_members')
    .delete()
    .eq('group_id', crewId)
    .eq('user_id', userId);
}

export async function deleteCrew(crewId: string) {
  return supabase
    .from('groups')
    .delete()
    .eq('id', crewId);
}
