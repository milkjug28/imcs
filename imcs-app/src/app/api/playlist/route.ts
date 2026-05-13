import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';

const youtube = google.youtube({ version: 'v3', auth: process.env.YOUTUBE_API_KEY });

const CACHE_TTL = 10 * 60 * 1000;
const cache = new Map<string, { tracks: any[]; cachedAt: number }>();

export async function GET(req: NextRequest) {
  const playlistId = req.nextUrl.searchParams.get('id') || 'PL6fZTBfxDZB0Gt5FGdutlBpMXuoGD0qWG';

  const cached = cache.get(playlistId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return NextResponse.json({ tracks: cached.tracks, cached: true });
  }

  try {
    const response = await youtube.playlistItems.list({
      part: ['snippet', 'contentDetails'],
      playlistId,
      maxResults: 50,
    });

    const tracks = response.data.items?.map(item => ({
      id: item.contentDetails?.videoId,
      title: item.snippet?.title,
      artist: (item.snippet?.videoOwnerChannelTitle || 'Various Artists').replace(/ - Topic$/, ''),
      thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url,
    })) || [];

    cache.set(playlistId, { tracks, cachedAt: Date.now() });
    return NextResponse.json({ tracks });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch playlist' }, { status: 500 });
  }
}
