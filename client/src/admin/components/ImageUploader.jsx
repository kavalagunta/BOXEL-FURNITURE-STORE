import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Trash2, Copy } from 'lucide-react';
import { uploadMedia } from '../../services/api.js';
import { Spinner } from '../../components/ui/States.jsx';
import { useToast } from '../../context/ToastContext.jsx';

function MediaItem({ media, onRemove, onReplace, busy }) {
  const video = media.resource_type === 'video' || media.type === 'video';
  const src = media.url || '';
  return <div className="flex gap-3 rounded border border-hairline p-2">
    {video ? <video src={src} className="size-20 shrink-0 rounded-sm bg-stone object-cover" muted /> : <img src={src} alt="" className="size-20 shrink-0 rounded-sm bg-stone object-cover" onError={(e) => { e.currentTarget.src = '/images/placeholder.svg'; }} />}
    <div className="min-w-0 flex-1"><p className="break-all text-xs text-graphite">{src}</p>
      {src && <button type="button" className="mt-1 inline-flex items-center gap-1 text-xs underline" onClick={() => navigator.clipboard.writeText(src)}><Copy className="size-3"/>Copy URL</button>}
      {media.progress != null && <progress className="mt-2 w-full" max="100" value={media.progress} />}
      {onReplace && <label className="btn btn-secondary btn-sm mt-2 cursor-pointer">Replace<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => onReplace(e.target.files?.[0])}/></label>}
    </div>
    {onRemove && <button type="button" className="self-start rounded p-1.5 text-danger" onClick={onRemove} aria-label="Remove media"><Trash2 className="size-4"/></button>}
  </div>;
}

/** Ordered product media uploader backed by the authenticated Cloudinary endpoint. */
export function ImageListEditor({ images, onChange, folder = 'products', max = 15, onBusyChange }) {
  const input = useRef(null); const [busy, setBusy] = useState(false); const [progress, setProgress] = useState(0); const [error, setError] = useState(''); const toast = useToast();
  const upload = async (files) => {
    if (!files?.length) return; setBusy(true); onBusyChange?.(true); setError('');
    try {
      const uploaded = [];
      for (const file of [...files].slice(0, max - images.length)) uploaded.push(await uploadMedia(file, folder, setProgress));
      onChange([...images, ...uploaded.map((f) => ({ url: f.url, public_id: f.public_id, resource_type: f.resource_type, alt: '' }))]); toast.success('Media uploaded to Cloudinary.');
    } catch (err) { setError(err.message); toast.error(err.message); }
    finally { setBusy(false); onBusyChange?.(false); setProgress(0); if (input.current) input.current.value = ''; }
  };
  const move = (i, d) => { const next = [...images]; [next[i], next[i + d]] = [next[i + d], next[i]]; onChange(next); };
  return <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload([...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'))); }}>
    <ul className="space-y-3">{images.map((img, i) => <li key={img.public_id || img.url} className="rounded border border-hairline p-2"><MediaItem media={img} busy={busy} onRemove={() => onChange(images.filter((_, j) => j !== i))} onReplace={async (file) => { if (!file) return; setBusy(true); onBusyChange?.(true); try { const f = await uploadMedia(file, folder, setProgress); onChange(images.map((x, j) => j === i ? { ...x, url: f.url, public_id: f.public_id, resource_type: f.resource_type } : x)); toast.success('Media replaced.'); } catch (e) { toast.error(e.message); } finally { setBusy(false); onBusyChange?.(false); } }} />
      <div className="mt-2 flex items-center gap-2"><label className="text-xs">Alt text <input className="field min-h-8 py-1" value={img.alt || ''} maxLength={255} onChange={(e) => onChange(images.map((x, j) => j === i ? { ...x, alt: e.target.value } : x))}/></label><button type="button" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-4"/></button><button type="button" disabled={i === images.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-4"/></button></div>
    </li>)}</ul>
    {images.length < max && <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded border border-dashed border-hairline px-4 py-6 text-sm text-graphite">{busy ? <><Spinner className="size-4" label="Uploading"/> Uploading {progress}%</> : <><ImagePlus className="size-4"/> Add images (JPEG, PNG, WebP; 5 MB max)</>}<input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => upload(e.target.files)} disabled={busy}/></label>}{error && <p className="field-error">{error}</p>}
  </div>;
}

/** Single image field for categories, banners and SEO images. */
export function SingleImageField({ label, value, onChange, folder = 'products', hint, error, onPublicIdChange, onBusyChange }) {
  const [busy, setBusy] = useState(false); const [progress, setProgress] = useState(0); const [err, setErr] = useState(''); const toast = useToast();
  const upload = async (file) => { if (!file) return; setBusy(true); onBusyChange?.(true); setErr(''); try { const media = await uploadMedia(file, folder, setProgress); onChange(media.url); onPublicIdChange?.(media.public_id); toast.success('Media uploaded to Cloudinary.'); } catch (e) { setErr(e.message); toast.error(e.message); } finally { setBusy(false); onBusyChange?.(false); setProgress(0); } };
  return <div><p className="field-label">{label}</p><div className="flex items-center gap-4"><div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-sm border border-hairline bg-stone">{value ? <img src={value} alt="" className="size-full object-cover" onError={(e) => { e.currentTarget.src = '/images/placeholder.svg'; }}/> : <ImagePlus className="size-5 text-graphite"/>}</div><div className="flex flex-wrap gap-2"><label className="btn btn-secondary btn-sm cursor-pointer">{busy ? `Uploading ${progress}%` : value ? 'Replace' : 'Upload'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} disabled={busy}/></label>{value && <button type="button" className="btn btn-secondary btn-sm" onClick={() => { onChange(''); onPublicIdChange?.(''); }}>Remove</button>}</div></div>{value && <div className="mt-2"><p className="break-all text-xs text-graphite">{value}</p><button type="button" className="inline-flex items-center gap-1 text-xs underline" onClick={() => navigator.clipboard.writeText(value)}><Copy className="size-3"/>Copy URL</button></div>}{hint && !err && !error && <p className="mt-1.5 text-[0.8125rem] text-graphite">{hint}</p>}{(err || error) && <p className="field-error">{err || error}</p>}</div>;
}

export function VideoField({ label, value, onChange, onPublicIdChange, onBusyChange }) {
  const [busy, setBusy] = useState(false); const [progress, setProgress] = useState(0); const toast = useToast();
  const upload = async (file) => { if (!file) return; setBusy(true); onBusyChange?.(true); try { const media = await uploadMedia(file, 'videos', setProgress); onChange(media.url); onPublicIdChange?.(media.public_id); toast.success('Video uploaded to Cloudinary.'); } catch (e) { toast.error(e.message); } finally { setBusy(false); onBusyChange?.(false); setProgress(0); } };
  return <div><p className="field-label">{label}</p>{value && <MediaItem media={{ url: value, resource_type: 'video', progress: busy ? progress : null }} onRemove={() => { onChange(''); onPublicIdChange?.(''); }} busy={busy}/>}<label className="btn btn-secondary btn-sm mt-2 cursor-pointer">{busy ? `Uploading ${progress}%` : value ? 'Replace video' : 'Upload video'}<input type="file" accept="video/mp4,video/webm" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} disabled={busy}/></label><p className="mt-1 text-xs text-graphite">MP4 or WebM, up to 50 MB.</p></div>;
}
