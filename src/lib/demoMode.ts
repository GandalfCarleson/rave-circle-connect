type ToastFn = (options: {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => void;

export const DEV_MODE_LIMITED_TITLE = 'Dev Mode is local only';
export const DEV_MODE_LIMITED_DESCRIPTION =
  'Use a real demo account for event, crew, chat, and saved-event flows.';

export function blockDevModeWrite(isDevMode: boolean, toast: ToastFn) {
  if (!isDevMode) return false;
  toast({
    title: DEV_MODE_LIMITED_TITLE,
    description: DEV_MODE_LIMITED_DESCRIPTION,
  });
  return true;
}
