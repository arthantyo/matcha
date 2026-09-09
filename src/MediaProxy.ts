import * as http from "http";
import axios from "axios";
import { convertAssToVtt } from "./Util";

export class MediaProxy {
  private static server: http.Server | null = null;
  private static port: number | null = null;

  private static upstreamBaseUrl: string | null = null;

  public static async start(): Promise<number> {
    if (this.server && this.port) {
      return this.port;
    }

    this.server = http.createServer(async (req, res) => {
      try {
        if (!req.url) {
          res.statusCode = 400;
          res.end();
          return;
        }

        const requestUrl = new URL(req.url, "http://127.0.0.1");

        let target: string | null = null;

        if (requestUrl.pathname === "/subtitles/") {
          const subtitleUrl = requestUrl.searchParams.get("url");

          if (!subtitleUrl) {
            res.statusCode = 400;
            res.end("Missing subtitle url");
            return;
          }

          console.log("Proxying subtitle:", subtitleUrl);

          const upstream = await axios.get(subtitleUrl, {
            headers: {
              Origin: "https://www.animeonsen.xyz",
              Referer: "https://www.animeonsen.xyz/",
              Accept: "*/*",
            },
            responseType: "text",
            validateStatus: () => true,
          });

          console.log("Subtitle status:", upstream.status);
          console.log("Subtitle raw:", String(upstream.data).slice(0, 500));

          if (upstream.status !== 200) {
            res.statusCode = upstream.status;
            res.end("Failed to fetch subtitle");
            return;
          }

          const vtt = convertAssToVtt(String(upstream.data));

          console.log("VTT:", vtt.slice(0, 500));

          const body = Buffer.from(vtt, "utf8");

          res.statusCode = 200;
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Content-Type", "text/vtt; charset=utf-8");
          res.setHeader("Content-Length", body.length);

          res.end(body);
          return;
        }

        // manifest request
        if (requestUrl.pathname === "/media/") {
          target = requestUrl.searchParams.get("url");

          if (!target) {
            res.statusCode = 400;
            res.end("Missing url");
            return;
          }

          // save:
          // https://cdn.../animeId/episode/
          this.upstreamBaseUrl = target.substring(
            0,
            target.lastIndexOf("/") + 1,
          );
        }

        // DASH segment request
        else if (requestUrl.pathname.startsWith("/media/")) {
          if (!this.upstreamBaseUrl) {
            res.statusCode = 400;
            res.end("No upstream media base");
            return;
          }

          const file = requestUrl.pathname.substring("/media/".length);

          target = new URL(file, this.upstreamBaseUrl).toString();
        }

        if (!target) {
          res.statusCode = 404;
          res.end();
          return;
        }

        console.log("Proxying:", target);

        const upstream = await axios.get(target, {
          headers: {
            Origin: "https://www.animeonsen.xyz",
            Referer: "https://www.animeonsen.xyz/",
            Accept: "*/*",
            Range: req.headers.range,
          },
          responseType: "arraybuffer",
          validateStatus: () => true,
        });

        if (target.endsWith("manifest.mpd")) {
          let mpd = Buffer.from(upstream.data).toString("utf8");

          mpd = mpd.replace(
            /<AdaptationSet[^>]*contentType="audio"[\s\S]*?<\/AdaptationSet>/g,
            "",
          );

          const body = Buffer.from(mpd, "utf8");

          res.statusCode = upstream.status;
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Content-Type", "application/dash+xml");
          res.setHeader("Content-Length", body.length);

          res.end(body);
          return;
        }
        res.statusCode = upstream.status;

        res.setHeader("Access-Control-Allow-Origin", "*");

        for (const header of [
          "content-type",
          "content-length",
          "content-range",
          "accept-ranges",
          "cache-control",
        ]) {
          const value = upstream.headers[header];

          if (value) {
            res.setHeader(header, value);
          }
        }

        res.end(Buffer.from(upstream.data));
      } catch (err) {
        console.error("Media proxy error:", err);

        res.statusCode = 500;
        res.end("Proxy error");
      }
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);

      this.server!.listen(0, "127.0.0.1", () => {
        const address = this.server!.address();

        if (typeof address === "object" && address) {
          this.port = address.port;
        }

        resolve();
      });
    });

    return this.port!;
  }

  public static async getProxyUrl(target: string): Promise<string> {
    const port = await this.start();

    return (
      `http://127.0.0.1:${port}/media/` + `?url=${encodeURIComponent(target)}`
    );
  }

  public static stop(): void {
    this.server?.close();

    this.server = null;
    this.port = null;
    this.upstreamBaseUrl = null;
  }

  public static async getSubtitleProxyUrl(target: string): Promise<string> {
    const port = await this.start();

    return (
      `http://127.0.0.1:${port}/subtitles/` +
      `?url=${encodeURIComponent(target)}`
    );
  }
}
