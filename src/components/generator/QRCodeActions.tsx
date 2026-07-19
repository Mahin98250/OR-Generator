import { Copy, Download } from 'lucide-react';
import { useGenerator } from './GeneratorContext';
import { GlassButton } from '../ui/GlassButton';

export function QRCodeActions() {
  const { dataUrl, settings } = useGenerator();

  async function copyText() {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(settings.value);
  }

  function downloadPng() {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = 'qr-code.png';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <div className="flex flex-wrap gap-3">
      <GlassButton type="button" onClick={copyText} className="gap-2 bg-white text-slate-950">
        <Copy size={14} /> Copy text
      </GlassButton>
      <GlassButton type="button" onClick={downloadPng} className="gap-2">
        <Download size={14} /> Download PNG
      </GlassButton>
    </div>
  );
}