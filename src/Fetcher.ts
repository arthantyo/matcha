/* eslint-disable @typescript-eslint/naming-convention */
import axios from "axios";
import { load } from "cheerio";
import { XMLParser } from "fast-xml-parser";
import { apiBaseUrl } from "./Constants";

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export class Fetcher {
  private static cache = new Map<string, { data: any; expiry: number }>();

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
    this.cache.set(key, { data, expiry: Date.now() + ttlMs });
    return data;
  }

  public static clearCache(): void {
    this.cache.clear();
  }

  public static async getMangaQuote() {
    const { data } = await axios.get(`${apiBaseUrl.quote}/api/random`);
    return data;
  }

  public static async getMangaSearch(query: string) {
    return this.withCache(`getMangaSearch:${query}`, () =>
      this.fetchMangaSearch(query),
    );
  }

  private static async fetchMangaSearch(query: string) {
    const result: Record<string, any> = {};

    try {
      const { data } = await axios.get(
        `${apiBaseUrl.demonicscans}/search.php?manga=${encodeURIComponent(query)}`,
      );
      const $ = load(data);

      result.results = $("body a:has(img)")
        .map((_i, element) => {
          const anchor = $(element);
          const href = anchor.attr("href");
          const id = href?.match(/\/manga\/([^/?#]+)/)?.[1];

          if (!id) {
            return null;
          }

          return {
            id,
            title: anchor.find("div").first().text().trim(),
            image: anchor.find("img").first().attr("src"),
          };
        })
        .get();

      return result;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  }

  public static async getMangaDirectory(page: number) {
    return this.withCache(`getMangaDirectory:${page}`, () =>
      this.fetchMangaDirectory(page),
    );
  }

  private static async fetchMangaDirectory(page: number) {
    const result: Record<string, any> = {};

    try {
      const { data } = await axios.get(
        `${apiBaseUrl.demonicscans}/advanced.php?list=${page}`,
      );
      const $ = load(data);

      result.hasNextPage =
        $(".pagination li").filter((_i, el) => $(el).text().trim() === "Next")
          .length > 0;

      result.results = $("#advanced-content > .advanced-element")
        .map((_i, el) => {
          const a = $(el).find("a").first();

          return {
            id: a.attr("href")?.split("/manga/")[1]!,
            title: a.attr("title"),
            image: a.find("img").attr("src"),
          };
        })
        .get();

      return result;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  }

  public static async getMangaInfo(mangaName: string) {
    return this.withCache(`getMangaInfo:${mangaName}`, () =>
      this.fetchMangaInfo(mangaName),
    );
  }

  private static async fetchMangaInfo(mangaName: string) {
    const result: Record<string, any> = {};

    try {
      const { data } = await axios.get(
        `${apiBaseUrl.demonicscans}/manga/${mangaName}`,
      );
      const $ = load(data);

      const firstChapterHref = $("#chapters-list li a.chplinks")
        .first()
        .attr("href");
      const mangaId = firstChapterHref?.match(
        /\/title\/([^/]+)\/chapter\//,
      )?.[1];

      result.id = mangaId ?? mangaName;
      result.title = $("h1.big-fat-titles").text().trim();
      result.image = $("#manga-page img").attr("src");

      result.chapters = $("#chapters-list li")
        .map((_i, el) => {
          const a = $(el).find("a.chplinks");
          const href = a.attr("href")!;
          const params = new URLSearchParams(href.split("?")[1]);
          const chapterId = params.get("chapter");

          return {
            id: chapterId,
            title: a.attr("title") ?? `Chapter ${chapterId}`,
            chapter: parseFloat(chapterId ?? "0"),
            url: `${apiBaseUrl.demonicscans}${href}`,
          };
        })
        .get();

      return result;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  }

  public static async getMangaUpdates() {
    return this.withCache("getMangaUpdates", () => this.fetchMangaUpdates());
  }

  private static async fetchMangaUpdates() {
    const results: {
      title: string;
      chapter: number;
      url: string;
      source: string;
    }[] = [];
    const source = "demonicscans";

    try {
      const { data } = await axios.get(
        `${apiBaseUrl.demonicscans}/lastupdates.php`,
      );
      const $ = load(data);

      $("#updates-container > .updates-element").each((_i, el) => {
        const titleEl = $(el).find("h2 > a").first();
        const title = titleEl.text().trim();
        if (!title) {
          return;
        }

        const chapterLink = $(el).find(".chap-date a.chplinks").first();
        const chapterText = chapterLink
          .text()
          .trim()
          .match(/(\d+(?:\.\d+)?)/);
        const chapterHref = chapterLink.attr("href");

        if (!chapterText || !chapterHref) {
          return;
        }

        results.push({
          title,
          chapter: parseFloat(chapterText[1]),
          url: `${apiBaseUrl.demonicscans}/${chapterHref}`,
          source,
        });
      });

      return results;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  }

  public static async getMangaFeed() {
    return this.withCache("getMangaFeed", () => this.fetchMangaFeed());
  }

  private static async fetchMangaFeed() {
    const result: Record<string, any> = [];

    try {
      const { data } = await axios.get(
        `${apiBaseUrl.news}/news/rss.xml?ann-edition=us`,
      );
      const json = new XMLParser().parse(data);
      const { item } = json.rss.channel;

      for (let i = 0; i < 10; i++) {
        const x = item[i];

        result.push({
          title: x.title,
          link: x.link,
          guid: x.guid,
          description: x.description.replace(/(<([^>]+)>)/gi, ""),
          pubDate: x.pubDate,
        });
      }
    } catch (err) {
      throw new Error((err as Error).message);
    }

    return result;
  }

  public static async getMangaChapters(mangaId: string, chapterId: string) {
    return this.withCache(`getMangaChapters:${mangaId}:${chapterId}`, () =>
      this.fetchMangaChapters(mangaId, chapterId),
    );
  }

  // gets the pages for chapter lol (dont mind the naming)
  private static async fetchMangaChapters(mangaId: string, chapterId: string) {
    const chapterPages: any[] = [];
    const url = `${apiBaseUrl.demonicscans}/title/${mangaId}/chapter/${chapterId}/1`;

    try {
      const { data } = await axios.get(url);

      const $ = load(data);

      $("img.imgholder").each((page, element) => {
        if (page === 0) {
          return;
        }

        const imageUrl = $(element).attr("src");

        if (imageUrl) {
          chapterPages.push({
            page,
            img: encodeURI(imageUrl),
            headerForImage: { Referer: url },
          });
        }
      });

      return chapterPages;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  }
}
