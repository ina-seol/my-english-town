import { assetUrl } from '../game/assetManager/manifest';
import { useManifest } from './useManifest';

/** Art icon from the manifest (ui/*.png) with an emoji fallback if the art is missing. */
export function Icon({ name, fallback, size = 28 }: { name: string; fallback: string; size?: number }) {
  const m = useManifest();
  const r = m?.ui?.[name];
  if (!r) return <span style={{ fontSize: size * 0.85, lineHeight: 1 }} aria-hidden>{fallback}</span>;
  return <img src={assetUrl(r.file)} alt="" aria-hidden style={{ height: size, width: 'auto', imageRendering: 'pixelated' }} />;
}
