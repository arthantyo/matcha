/* eslint-disable @typescript-eslint/naming-convention */

import axios from "axios";

const DEFAULT_TTL_MS = 5 * 60 * 1000;

type AnimeOnsenToken = {
  access_token: string;
  expires_in: number;
  token_type?: string;
};

export class AnimeOnsenFetcher {
  private static readonly apiBaseUrl = "https://api.animeonsen.xyz";
  private static readonly authBaseUrl = "https://auth.animeonsen.xyz";
  private static readonly cdnBaseUrl = "https://cdn.animeonsen.xyz";

  private static cache = new Map<
    string,
    {
      data: any;
      expiry: number;
    }
  >();

  private static token: string | null = null;
  private static tokenExpiry = 0;

  private static async withCache<T>(
    key: string,
    fn: () => Promise<T>,
    ttlMs: number = DEFAULT_TTL_MS,
  ): Promise<T> {
    const cached = this.cache.get(key);

    if (cached && cached.expiry > Date.now()) {
      return cached.data as T;
    }

    const data = await fn();

    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs,
    });

    return data;
  }

  public static clearCache(): void {
    this.cache.clear();
  }

  // --------------------------------------------------
  // Authentication
  // --------------------------------------------------

  private static async getToken(): Promise<string> {
    // Keep 1 hour of headroom, like the old Dart provider.
    if (this.token && this.tokenExpiry > Date.now() + 60 * 60 * 1000) {
      return this.token;
    }

    const clientId = "f296be26-28b5-4358-b5a1-6259575e23b7";
    const clientSecret =
      "349038c4157d0480784753841217270c3c5b35f4281eaee029de21cb04084235";

    if (!clientId || !clientSecret) {
      throw new Error(
        "Missing ANIMEONSEN_CLIENT_ID or ANIMEONSEN_CLIENT_SECRET",
      );
    }

    const { data } = await axios.post<AnimeOnsenToken>(
      `${this.authBaseUrl}/oauth/token`,
      {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      },
    );

    this.token = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;

    return this.token;
  }

  private static async getHeaders() {
    const token = await this.getToken();

    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };
  }

  // --------------------------------------------------
  // Anime directory / index
  // --------------------------------------------------

  public static async getAnimeDirectory(start: number = 0, limit: number = 30) {
    return this.withCache(`getAnimeDirectory:${start}:${limit}`, () =>
      this.fetchAnimeDirectory(start, limit),
    );
  }

  private static async fetchAnimeDirectory(start: number, limit: number) {
    try {
      const headers = await this.getHeaders();

      const { data } = await axios.get(`${this.apiBaseUrl}/v4/content/index`, {
        headers,
        params: {
          start,
          limit,
        },
      });

      const entries = data.content;

      return {
        results: entries.map((item: any) => ({
          id: item.content_id ?? item.id,
          title: item.content_title_en ?? item.content_title ?? "Unknown",
          image: `https://raw.githubusercontent.com/arthantyo/matcha/0ff2df8e20c6bd854ffaf5ad9ac4136be5661579/media/no_image.png`,
        })),
      };
    } catch (err) {
      throw this.handleError(err);
    }
  }

  // --------------------------------------------------
  // Search
  // --------------------------------------------------

  public static async searchAnime(query: string) {
    return this.withCache(`searchAnime:${query}`, () =>
      this.fetchAnimeSearch(query),
    );
  }

  private static async fetchAnimeSearch(query: string) {
    try {
      const headers = await this.getHeaders();

      const normalizedQuery = query.replace(/-/g, "");

      const { data } = await axios.get(
        `${this.apiBaseUrl}/v4/search/${encodeURIComponent(normalizedQuery)}`,
        {
          headers,
        },
      );

      return {
        results: (data.result ?? []).map((item: any) => ({
          id: item.content_id,

          title: item.content_title_en ?? item.content_title ?? "Unknown",

          image: `${this.apiBaseUrl}/v4/image/210x300/${item.content_id}`,
        })),
      };
    } catch (err) {
      throw this.handleError(err);
    }
  }

  // --------------------------------------------------
  // Episodes
  // --------------------------------------------------

  public static async getAnimeEpisodes(animeId: string) {
    return this.withCache(`getAnimeEpisodes:${animeId}`, () =>
      this.fetchAnimeEpisodes(animeId),
    );
  }

  private static async fetchAnimeEpisodes(animeId: string) {
    try {
      const headers = await this.getHeaders();

      const { data } = await axios.get(
        `${this.apiBaseUrl}/v4/content/${animeId}/episodes`,
        {
          headers,
        },
      );

      return Object.entries(data).map(
        ([episodeNumber, episode]: [string, any]) => ({
          id: `${episodeNumber}+${animeId}`,

          episodeNumber: Number(episodeNumber),

          title: episode.contentTitle_episode_en || `Episode ${episodeNumber}`,

          animeId,
        }),
      );
    } catch (err) {
      throw this.handleError(err);
    }
  }

  // --------------------------------------------------
  // Info (metadata + episodes)
  // --------------------------------------------------

  public static async getAnimeInfo(animeId: string) {
    return this.withCache(`getAnimeInfo:${animeId}`, () =>
      this.fetchAnimeInfo(animeId),
    );
  }

  private static async fetchAnimeInfo(animeId: string) {
    try {
      const headers = await this.getHeaders();

      const { data } = await axios.get(
        `${this.apiBaseUrl}/v4/content/${animeId}`,
        {
          headers,
        },
      );

      const episodes = await this.fetchAnimeEpisodes(animeId);

      return {
        id: data.content_id ?? animeId,
        title: data.content_title_en ?? data.content_title ?? "Unknown",
        image: `${this.apiBaseUrl}/v4/image/210x300/${animeId}`,
        episodes,
      };
    } catch (err) {
      throw this.handleError(err);
    }
  }

  // --------------------------------------------------
  // Stream
  // --------------------------------------------------

  public static async getAnimeStream(
    animeId: string,
    episodeNumber: number | string,
  ) {
    const streamUrl =
      `${this.cdnBaseUrl}/video/mp4-dash/` +
      `${animeId}/${episodeNumber}/manifest.mpd`;

    const subtitleUrl =
      `${this.apiBaseUrl}/v4/subtitles/` + `${animeId}/en-US/${episodeNumber}`;

    return {
      server: "animeonsen",
      quality: "multi-quality",
      url: streamUrl,
      subtitle: subtitleUrl,
      subtitleFormat: "ass",
      headers: {
        Origin: "https://www.animeonsen.xyz",
        Referer: "https://www.animeonsen.xyz/",
      },
    };
  }

  // Same idea as the Dart episodeId:
  //
  // "1+lT29m9oG23x3Yb47"
  //
  public static async getAnimeStreamFromEpisodeId(episodeId: string) {
    const [episodeNumber, animeId] = episodeId.split("+");

    if (!episodeNumber || !animeId) {
      throw new Error(`Invalid episode id: ${episodeId}`);
    }

    return this.getAnimeStream(animeId, episodeNumber);
  }

  // --------------------------------------------------
  // Error handling
  // --------------------------------------------------

  private static handleError(err: unknown): Error {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;

      const message =
        typeof err.response?.data === "string"
          ? err.response.data
          : JSON.stringify(err.response?.data);

      return new Error(
        `AnimeOnsen request failed${
          status ? ` (${status})` : ""
        }: ${message || err.message}`,
      );
    }

    return new Error(
      err instanceof Error ? err.message : "Unknown AnimeOnsen error",
    );
  }
}
