import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { optimizeImage, validateImage } from '../src/image-optimizer.mjs';

describe('image optimizer', () => {
  it('writes and validates a 16:9 webp image', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'image-opt-'));
    const input = path.join(dir, 'input.png');
    const output = path.join(dir, 'light.webp');
    await sharp({ create: { width: 1600, height: 900, channels: 3, background: '#336699' } }).png().toFile(input);
    const result = await optimizeImage(input, output, { width: 1600, height: 900, max_bytes: 1048576 });
    expect(result.width).toBe(1600);
    expect(result.height).toBe(900);
    expect(result.format).toBe('webp');
    expect((await stat(output)).size).toBeGreaterThan(0);
    const validation = await validateImage(output, { width: 1600, height: 900, max_bytes: 1048576 });
    expect(validation.ok).toBe(true);
  });
});
