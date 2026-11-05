import Phaser from 'phaser';
import { DEFAULT_PX_PER_TILE, assetUrl, fetchManifest, listImages, type Manifest } from '../assetManager/manifest';
import { ensurePlaceholders } from '../assetManager/placeholders';

/**
 * Loads the (optional) art manifest and its images, tolerating any failure, then
 * generates placeholders for everything that is still missing.
 */
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    void this.start();
  }

  private async start() {
    const manifest: Manifest | null = await fetchManifest();
    this.registry.set('manifest', manifest);
    this.registry.set('pxPerTile', manifest?.pxPerTile ?? DEFAULT_PX_PER_TILE);
    const missing: string[] = [];
    if (manifest) {
      // Prefer the packed atlases (a handful of requests); fall back to the individual PNGs.
      const useAtlas = (manifest.atlases?.length ?? 0) > 0;
      const list = useAtlas ? manifest.atlases!.map((a) => [a.key, a.image] as [string, string]) : listImages(manifest);
      if (useAtlas) manifest.atlases!.forEach((a) => this.load.atlas(a.key, assetUrl(a.image), assetUrl(a.data)));
      else list.forEach(([key, file]) => this.load.image(key, assetUrl(file)));
      this.load.on(Phaser.Loader.Events.PROGRESS, (v: number) => this.game.events.emit('load-progress', v));
      this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (f: Phaser.Loader.File) => missing.push(f.key));
      await new Promise<void>((resolve) => {
        if (list.length === 0) return resolve();
        this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
        this.load.start();
      });
    }
    if (missing.length) console.warn(`[assets] ${missing.length} image(s) failed to load; using placeholders`, missing.slice(0, 10));
    this.registry.set('missingAssets', missing);
    const frames: Record<string, string> = {};
    for (const a of manifest?.atlases ?? []) {
      if (!this.textures.exists(a.key)) continue;
      for (const name of this.textures.get(a.key).getFrameNames()) frames[name] = a.key;
    }
    this.registry.set('frames', frames);
    try { ensurePlaceholders(this); } catch (e) { console.error('[assets] placeholder generation failed', e); }
    this.scene.start('Town');
  }
}
