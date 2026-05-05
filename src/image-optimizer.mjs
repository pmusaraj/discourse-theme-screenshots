import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export async function optimizeImage(inputPath, outputPath, options = {}) {
  const width = options.width ?? 2560;
  const height = options.height ?? 1440;
  const maxBytes = options.max_bytes ?? options.maxBytes ?? 1048576;
  await mkdir(path.dirname(outputPath), { recursive: true });
  let finalInfo;
  let warnings = [];
  for (const quality of [86, 80, 74, 68, 62, 60]) {
    finalInfo = await sharp(inputPath).resize(width, height, { fit: 'cover' }).webp({ quality }).toFile(outputPath);
    const size = (await stat(outputPath)).size;
    if (size <= maxBytes || quality === 60) {
      if (size > maxBytes) warnings.push(`Image exceeds max_bytes (${size} > ${maxBytes}) at quality ${quality}`);
      return { ...finalInfo, path: outputPath, size, format: 'webp', quality, warnings };
    }
  }
  return finalInfo;
}

export async function validateImage(filePath, options = {}) {
  const width = options.width ?? 2560;
  const height = options.height ?? 1440;
  const maxBytes = options.max_bytes ?? options.maxBytes ?? 1048576;
  const metadata = await sharp(filePath).metadata();
  const size = (await stat(filePath)).size;
  const warnings = [];
  if (metadata.width !== width || metadata.height !== height) warnings.push(`Expected ${width}x${height}, got ${metadata.width}x${metadata.height}`);
  const ratioOk = metadata.width * 9 === metadata.height * 16;
  if (!ratioOk) warnings.push('Image is not 16:9');
  if (metadata.format !== 'webp') warnings.push(`Expected webp, got ${metadata.format}`);
  if (size > maxBytes) warnings.push(`Image exceeds max_bytes (${size} > ${maxBytes})`);
  return { ok: warnings.length === 0, warnings, width: metadata.width, height: metadata.height, format: metadata.format, size, path: filePath };
}
