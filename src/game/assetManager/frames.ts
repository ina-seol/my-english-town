import type Phaser from 'phaser';

/** texture key -> atlas texture that contains it as a frame (empty when art is not loaded). */
export function frameMap(scene: Phaser.Scene): Record<string, string> {
  return (scene.registry.get('frames') as Record<string, string> | undefined) ?? {};
}
export function hasKey(scene: Phaser.Scene, key: string): boolean {
  return !!frameMap(scene)[key] || scene.textures.exists(key);
}
export function addImage(scene: Phaser.Scene, x: number, y: number, key: string): Phaser.GameObjects.Image {
  const atlas = frameMap(scene)[key];
  return atlas ? scene.add.image(x, y, atlas, key) : scene.add.image(x, y, key);
}
export function setImageKey(scene: Phaser.Scene, img: Phaser.GameObjects.Image, key: string) {
  const atlas = frameMap(scene)[key];
  if (atlas) img.setTexture(atlas, key); else img.setTexture(key);
  return img;
}
