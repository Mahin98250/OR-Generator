import { Copy, Download, Share2 } from 'lucide-react';
import { GlassButton } from '../ui/GlassButton';

export function GeneratorToolbar() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <GlassButton className="gap-2">
        <Download size={14} /> Download
      </GlassButton>
      <GlassButton className="gap-2">
        <Copy size={14} /> Copy
      </GlassButton>
      <GlassButton className="gap-2">
        <Share2 size={14} /> Share
      </GlassButton>
    </div>
  );
}