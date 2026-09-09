<script lang="ts">
  import { onMount, tick } from "svelte";
  import * as dashjs from "dashjs";

  let video: HTMLVideoElement;
  let player: dashjs.MediaPlayerClass | null = null;

  let subtitleUrl = "";
  let subtitleBlobUrl = "";

  declare const tsvscode: {
    postMessage(message: any): void;
  };

  async function loadSubtitle(url: string) {
    if (subtitleBlobUrl) {
      URL.revokeObjectURL(subtitleBlobUrl);
      subtitleBlobUrl = "";
    }

    const response = await fetch(url);

    if (!response.ok) {
      console.error("Subtitle fetch failed:", response.status);
      return;
    }

    const vtt = await response.text();

    console.log("VTT:", vtt.slice(0, 500));

    const blob = new Blob([vtt], {
      type: "text/vtt",
    });

    subtitleBlobUrl = URL.createObjectURL(blob);

    await tick();

    if (video.textTracks.length > 0) {
      video.textTracks[0].mode = "showing";
    }
  }

  onMount(() => {
    const handleMessage = async (event: MessageEvent) => {
      const message = event.data;

      if (message.type === "load_video") {
        console.log("Loading subtitle:", message.data.subtitle);
        console.log("Loading DASH:", message.data.url);

        player?.reset();

        subtitleUrl = message.data.subtitle ?? "";

        if (subtitleUrl) {
          await loadSubtitle(subtitleUrl);
        }

        player = dashjs.MediaPlayer().create();

        player.on(dashjs.MediaPlayer.events.ERROR, (e) => {
          console.error("DASH error:", e);
        });

        player.initialize(
          video,
          message.data.url,
          false,
        );
      }
    };

    window.addEventListener("message", handleMessage);

    tsvscode.postMessage({
      type: "video_ready",
    });

    return () => {
      window.removeEventListener("message", handleMessage);

      player?.reset();

      if (subtitleBlobUrl) {
        URL.revokeObjectURL(subtitleBlobUrl);
      }
    };
  });
</script>

<div class="player-container">
  <!-- svelte-ignore a11y-media-has-caption -->
  <video bind:this={video} controls playsinline>
    {#if subtitleBlobUrl}
      <track
        kind="subtitles"
        src={subtitleBlobUrl}
        srclang="en"
        label="English"
        default
      />
    {/if}
  </video>
</div>


<style>
  :global(body) {
    margin: 0;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }

  .player-container {
    width: 100%;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
  }

  video {
    width: min(1200px, 95vw);
    max-height: 90vh;
    aspect-ratio: 16 / 9;
    object-fit: contain;
    background: #000;
  }
</style>