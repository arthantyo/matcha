import * as vscode from "vscode";
import { MangaExplorePanel } from "../views/MangaExplorePanel";
import { AnimeExplorePanel } from "../views/AnimeExplorePanel";
import { Storage } from "../Storage";
import { Sidebar } from "../views/Sidebar";
import { Fetcher } from "../Fetcher";
import { AnimeOnsenFetcher } from "../AnimeOnsenFetcher";
import { ChapterPanel } from "../views/ChapterPanel";
import { VideoPlayerPanel } from "../views/VideoPlayerPanel";
import { MediaProxy } from "../MediaProxy";

interface ICommand {
  execute(msg: any): void;
}

export class SidebarCommand {
  commands: { [id: string]: ICommand } = {};
  _webview: Sidebar;
  _extensionUri: vscode.Uri;

  _animeHistory: Record<string, any> = {};
  _mangaHistory: Record<string, any> = {};

  constructor(webview: Sidebar, extensionUri: vscode.Uri) {
    this._webview = webview;
    this._extensionUri = extensionUri;

    this.registerDefaultCommands();
    this.registerMangaCommands();
    this.registerAnimeCommands();
  }

  register(commandName: string, command: ICommand) {
    this.commands[commandName] = command;
  }

  execute(commandName: string, msg: any) {
    if (commandName in this.commands) {
      this.commands[commandName].execute(msg);
    } else {
      console.log(`Command [${commandName}] not recognised`);
    }
  }

  private registerDefaultCommands() {
    const webview = this._webview;
    const extensionUri = this._extensionUri;

    this.register("open_manga_explorer", {
      execute() {
        MangaExplorePanel.createOrShow(extensionUri);
      },
    });

    this.register("open_anime_explorer", {
      execute() {
        AnimeExplorePanel.createOrShow(extensionUri);
      },
    });

    this.register("show_manga_news", {
      async execute() {
        const mangaNewsFeed = await Fetcher.getMangaFeed();

        webview._webview?.webview.postMessage({
          type: "manga_news",
          data: mangaNewsFeed,
        });
      },
    });

    this.register("show_history", {
      async execute() {
        const mangaHistory = Storage.getMangaHistory();
        webview._webview?.webview.postMessage({
          type: "history",
          data: {
            manga: mangaHistory,
          },
        });
      },
    });

    this.register("show_bookmarks", {
      async execute() {
        const mangaBookmarks = Storage.getMangaBookmarks();
        webview._webview?.webview.postMessage({
          type: "bookmarks",
          data: mangaBookmarks,
        });
      },
    });
  }

  private async registerMangaCommands() {
    const rootThis = this;
    const webview = this._webview;
    const extensionUri = this._extensionUri;

    this.register("show_manga_info", {
      async execute(msg) {
        const mangaInfo = await Fetcher.getMangaInfo(msg.data.manga_id);

        webview._webview?.webview.postMessage({
          type: "manga_info",
          data: mangaInfo,
        });
      },
    });

    this.register("toggle_bookmark", {
      async execute(msg) {
        const manga = msg.data.manga;
        const bookmarks = Storage.getMangaBookmarks();

        if (bookmarks[manga.id]) {
          Storage.removeMangaBookmark(manga.id);
        } else {
          Storage.insertMangaBookmark(manga);
        }

        webview._webview?.webview.postMessage({
          type: "bookmarks",
          data: Storage.getMangaBookmarks(),
        });
      },
    });

    this.register("open_manga_chapter", {
      execute: (msg) => {
        const manga = msg.data.manga;
        const index = msg.data.chapterIndex;
        const nextChapter = manga.chapters[index - 1]?.id;
        const prevChapter = manga.chapters[index + 1]?.id;

        const context = {
          manga,
          chapterTitle: manga.chapters[index].title,
          chapterId: manga.chapters[index].id,
          previousChapter: prevChapter === undefined ? null : index + 1,
          nextChapter: nextChapter === undefined ? null : index - 1,
          chapterIdx: index,
        };

        rootThis._mangaHistory[manga.title] = {
          chapter: context,
          title: manga.title,
        };

        Storage.insertMangaHistory({
          chapter: context,
          title: manga.title,
        });

        vscode.window.showInformationMessage(
          `Opening ${manga.title}: ${context.chapterTitle}`,
        );

        ChapterPanel.createOrShow(extensionUri, context);
      },
    });
  }

  private async registerAnimeCommands() {
    const rootThis = this;
    const webview = this._webview;
    const extensionUri = this._extensionUri;

    this.register("show_anime_info", {
      async execute(msg) {
        const animeInfo = await AnimeOnsenFetcher.getAnimeInfo(
          msg.data.anime_id,
        );

        webview._webview?.webview.postMessage({
          type: "anime_info",
          data: animeInfo,
        });
      },
    });

    this.register("toggle_anime_bookmark", {
      async execute(msg) {
        const anime = msg.data.anime;
        const bookmarks = Storage.getAnimeBookmarks();

        if (bookmarks[anime.id]) {
          Storage.removeAnimeBookmark(anime.id);
        } else {
          Storage.insertAnimeBookmark(anime);
        }

        webview._webview?.webview.postMessage({
          type: "anime_bookmarks",
          data: Storage.getAnimeBookmarks(),
        });
      },
    });

    this.register("open_anime_episode", {
      execute: async (msg) => {
        const anime = msg.data.anime;
        const episode = msg.data.episode;

        const stream = await AnimeOnsenFetcher.getAnimeStream(
          anime.id,
          episode.episodeNumber,
        );

        rootThis._animeHistory[anime.title] = {
          episode,
          title: anime.title,
        };

        Storage.insertAnimeHistory({
          episode,
          title: anime.title,
        });

        vscode.window.showInformationMessage(
          `Opening ${anime.title}: ${episode.title}`,
        );

        const proxiedUrl = await MediaProxy.getProxyUrl(stream.url);

        const subtitleUrl =
          `https://api.animeonsen.xyz/v4/subtitles/` +
          `${anime.id}/en-US/${episode.episodeNumber}`;

        const proxiedSubtitleUrl =
          await MediaProxy.getSubtitleProxyUrl(subtitleUrl);

        VideoPlayerPanel.createOrShow(extensionUri, proxiedUrl, proxiedSubtitleUrl);
      },
    });
  }
}
