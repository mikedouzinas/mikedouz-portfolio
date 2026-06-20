import { NextResponse } from 'next/server';
import { readdir } from 'fs/promises';
import path from 'path';
import { z } from 'zod';

export const runtime = 'nodejs';

/**
 * Lists the "vibe" photos that show behind the frosted glass of the WINDOW
 * portal face (the WindowFace entrance to THE HARLEQUIN). Reads
 * `public/portal/` at request time and returns `/portal/...` URLs.
 *
 * Future-proof: Mike drops new photos into `public/portal/` and they appear
 * automatically — no JSON to edit. Filenames become captions client-side
 * (captions are currently hidden, matching the lockup).
 */

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.avif',
]);

const PortalImagesResponse = z.object({
  images: z.array(
    z.object({
      src: z.string(),
      label: z.string(),
    }),
  ),
});

type PortalImagesResponse = z.infer<typeof PortalImagesResponse>;

/** "san-fran.JPG" → "San Fran" — prettify a filename into a caption. */
function prettifyLabel(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '');
  return base
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export async function GET() {
  const portalDir = path.join(process.cwd(), 'public', 'portal');

  let files: string[] = [];
  try {
    files = await readdir(portalDir);
  } catch {
    // Folder missing → empty list rather than an error.
    return NextResponse.json({ images: [] } satisfies PortalImagesResponse);
  }

  const images = files
    .filter((file) => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()))
    .filter((file) => !file.startsWith('.'))
    .sort()
    .map((file) => ({
      src: `/portal/${file}`,
      label: prettifyLabel(file),
    }));

  const payload = PortalImagesResponse.parse({ images });
  return NextResponse.json(payload);
}
