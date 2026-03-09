export interface SpotifySong {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArt: string;
  spotifyUrl?: string;
  period: string;
  year: number;
  significance?: string;
}
