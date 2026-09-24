import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { GlassButton } from './GlassButton';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function InstallPWAButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!promptEvent) return null;

  async function install() {
    await promptEvent?.prompt();
    const choice = await promptEvent?.userChoice;
    if (choice?.outcome === 'accepted') setPromptEvent(null);
  }

  return (
    <GlassButton onClick={() => void install()} className="hidden sm:inline-flex">
      <Download size={15} />
      Install
    </GlassButton>
  );
}
