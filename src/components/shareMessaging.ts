import type { ShortenError } from '../lib/leaflet-client';

export const SHARE_CONNECT_TITLE = 'Connect to enable link sharing';
export const SHARE_CONNECT_BODY = 'This Share button works when you are connected.';
export const SHARE_CONNECT_BENEFIT = 'Connected sharing uses shorter links that are easier to send.';
export const SHARE_CONNECT_INSTRUCTIONS = 'Open the sidebar to connect anonymously or sign in.';

export const SHARE_CONNECT_STEPS = [
  'Open the menu sidebar',
  'Select Connect anonymously or Sign in',
] as const;

export const NAV_SHARE_UPSELL_BODY =
  'Your full link was copied. Connect for shorter links and to use the Share button.';

function getShortenErrorLead(error: ShortenError): string {
  if (error.type === 'rate-limited') {
    return error.retryAfter != null
      ? `Short link limit reached. Try again in ${error.retryAfter}s.`
      : 'Short link limit reached. Try again soon.';
  }

  return 'Could not shorten the link right now.';
}

export function getShortenModalMessage(error: ShortenError): string {
  return `${getShortenErrorLead(error)} The original link is shown below.`;
}

export function getShortenCopiedFallbackMessage(error: ShortenError): string {
  return `${getShortenErrorLead(error)} Full link copied.`;
}

export function getShortenManualFallbackMessage(error: ShortenError): string {
  return `${getShortenErrorLead(error)} URL updated — copy from address bar.`;
}
