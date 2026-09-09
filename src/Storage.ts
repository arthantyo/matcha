import { Desktop } from "./Desktop";
import { join } from "path";
import fs from "fs";
import JSONdb from "simple-json-db";

export class Storage {
  public static database: JSONdb;

  public static async checkDatabase() {
    const homeDir = Desktop.getHomeDirectory();

    const configDir = join(homeDir, ".matcha-vscode");

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(join(configDir, "database.json"), "");

      this.database = new JSONdb(join(configDir, "database.json"), {});

      this.database.set("mangaHistory", {});
      this.database.set("mangaBookmarks", {});
      this.database.set("animeHistory", {});
      this.database.set("animeBookmarks", {});
    }

    this.database = new JSONdb(join(configDir, "database.json"), {});
  }
  public static insertMangaHistory(data: any): void {
    this.checkDatabase();

    let history: Record<string, any> = this.database.get("mangaHistory");

    history[data.title] = data;

    this.database.set("mangaHistory", history);
  }

  public static getMangaHistory() {
    this.checkDatabase();
    const history = this.database.get("mangaHistory");

    return history;
  }

  public static insertMangaBookmark(data: any): void {
    this.checkDatabase();

    const bookmarks: Record<string, any> =
      this.database.get("mangaBookmarks") || {};

    bookmarks[data.id] = data;

    this.database.set("mangaBookmarks", bookmarks);
  }

  public static removeMangaBookmark(mangaId: string): void {
    this.checkDatabase();

    const bookmarks: Record<string, any> =
      this.database.get("mangaBookmarks") || {};

    delete bookmarks[mangaId];

    this.database.set("mangaBookmarks", bookmarks);
  }

  public static getMangaBookmarks(): Record<string, any> {
    this.checkDatabase();

    return this.database.get("mangaBookmarks") || {};
  }

  public static insertAnimeHistory(data: any): void {
    this.checkDatabase();

    const history: Record<string, any> =
      this.database.get("animeHistory") || {};

    history[data.title] = data;

    this.database.set("animeHistory", history);
  }

  public static getAnimeHistory() {
    this.checkDatabase();

    return this.database.get("animeHistory") || {};
  }

  public static insertAnimeBookmark(data: any): void {
    this.checkDatabase();

    const bookmarks: Record<string, any> =
      this.database.get("animeBookmarks") || {};

    bookmarks[data.id] = data;

    this.database.set("animeBookmarks", bookmarks);
  }

  public static removeAnimeBookmark(animeId: string): void {
    this.checkDatabase();

    const bookmarks: Record<string, any> =
      this.database.get("animeBookmarks") || {};

    delete bookmarks[animeId];

    this.database.set("animeBookmarks", bookmarks);
  }

  public static getAnimeBookmarks(): Record<string, any> {
    this.checkDatabase();

    return this.database.get("animeBookmarks") || {};
  }

  public static reset() {
    const homeDir = Desktop.getHomeDirectory();
    const configDir = join(homeDir, ".matcha-vscode");
    fs.rmSync(configDir, { recursive: true, force: true });
  }
}
