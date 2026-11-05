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
      const list = listImages(manifest);
      list.forEach(([key, file]) => this.load.image(key, assetUrl(file)));
      this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (f: Phaser.Loader.File) => missing.push(f.key));
      await new Promise<void>((resolve) => {
        if (list.length === 0) return resolve();
        this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
        this.load.start();
      });
    }
    if (missing.length) console.warn(`[assets] ${missing.length} image(s) failed to load; using placeholders`, missing.slice(0, 10));
    this.registry.set('missingAssets', missing);
    try { ensurePlaceholders(this); } catch (e) { console.error('[assets] placeholder generation failed', e); }
    this.scene.start('Town');
  }
}
