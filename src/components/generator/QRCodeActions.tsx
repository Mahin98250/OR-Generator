import { Copy, Download, FileImage, Heart, Share2 } from 'lucide-react';
import { useGenerator } from './GeneratorContext';
import { GlassButton } from '../ui/GlassButton';
import { saveHistoryItem, toggleFavorite } from '../../lib/storage';
import { toQrDataUrl, toQrSvg } from '../../lib/qr';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function QRCodeActions() {
  const { dataUrl, settings } = useGenerator();

  async function copyText() {
    if (!settings.value.trim() || !navigator.clipboard) return;
    await navigator.clipboard.writeText(settings.value);
  }

  async function copyImage() {
    if (!dataUrl || !navigator.clipboard || typeof ClipboardItem === 'undefined') return;

    const response = await fetch(dataUrl);
    const blob = await response.blob();
    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type || 'image/png']: blob }),
    ]);
  }

  function downloadPng() {
    if (!dataUrl) return;
    const byteCharacters = atob(dataUrl.split(',')[1] ?? '');
    const bytes = new Uint8Array(byteCharacters.length);
    for (let index = 0; index < byteCharacters.length; index += 1) {
      bytes[index] = byteCharacters.charCodeAt(index);
    }
    downloadBlob(new Blob([bytes], { type: 'image/png' }), 'qr-code.png');
  }

  async function downloadJpeg() {
    if (!settings.value.trim()) return;
    const jpeg = await toQrDataUrl(settings, 'image/jpeg');
    const byteCharacters = atob(jpeg.split(',')[1] ?? '');
    const bytes = new Uint8Array(byteCharacters.length);
    for (let index = 0; index < byteCharacters.length; index += 1) {
      bytes[index] = byteCharacters.charCodeAt(index);
    }
    downloadBlob(new Blob([bytes], { type: 'image/jpeg' }), 'qr-code.jpg');
  }

  async function downloadSvg() {
    if (!settings.value.trim()) return;
    const svg = await toQrSvg(settings);
    downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), 'qr-code.svg');
  }

  async function share() {
    if (!navigator.share || !settings.value.trim()) return;
    await navigator.share({
      title: 'QR code',
      text: settings.value,
    });
  }

  function save() {
    if (!settings.value.trim()) return;
    saveHistoryItem(settings.value);
  }

  function favorite() {
    const item = saveHistoryItem(settings.value);
    toggleFavorite(item.id);
  }

  const disabled = !settings.value.trim();

  return (
    <div className="flex flex-wrap gap-3">
      <GlassButton type="button" disabled={disabled} onClick={() => void copyText()} className="gap-2 bg-white text-slate-950">
        <Copy size={14} /> Copy text
      </GlassButton>
      <GlassButton type="button" disabled={!dataUrl} onClick={downloadPng} className="gap-2">
        <Download size={14} /> PNG
      </GlassButton>
      <GlassButton type="button" disabled={disabled} onClick={() => void downloadSvg()} className="gap-2">
        <Download size={14} /> SVG
      </GlassButton>
      <GlassButton type="button" disabled={disabled} onClick={() => void downloadJpeg()} className="gap-2">
        <FileImage size={14} /> JPEG
      </GlassButton>
      <GlassButton type="button" disabled={!dataUrl || typeof ClipboardItem === 'undefined'} onClick={() => void copyImage()} className="gap-2">
        <Copy size={14} /> Copy image
      </GlassButton>
      <GlassButton type="button" disabled={!navigator.share || disabled} onClick={() => void share()} className="gap-2">
        <Share2 size={14} /> Share
      </GlassButton>
      <GlassButton type="button" disabled={disabled} onClick={save} className="gap-2">
        <Download size={14} /> Save
      </GlassButton>
      <GlassButton type="button" disabled={disabled} onClick={favorite} className="gap-2">
        <Heart size={14} /> Favorite
      </GlassButton>
    </div>
  );
}
