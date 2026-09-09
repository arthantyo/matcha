<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import Loader from "./Loader.svelte";
  import Button from "./Button.svelte";

  export let animeId: string;
  let anime: Record<string, any> = {};
  let bookmarks: Record<string, any> = {};

  let loaded = false;

  $: isBookmarked = !!bookmarks[anime.id ?? animeId];

  onMount(() => {
    tsvscode.postMessage({
      type: "default",
      data: {
        command: "show_bookmarks",
      },
    });

    window.addEventListener("message", (event) => {
      const msg = event.data;
      switch (msg.type) {
        case "anime_info":
          anime = msg.data;
          loaded = true;
          break;
        case "anime_bookmarks":
          bookmarks = msg.data;
          break;
      }
    });
  });

  $: {
    loaded = false;
    tsvscode.postMessage({
      type: "anime",
      data: {
        command: "show_anime_info",
        anime_id: animeId,
      },
    });
  }

  const openAnimeEpisode = (episode: any) => {
    tsvscode.postMessage({
      type: "anime",
      data: {
        command: "open_anime_episode",
        anime: anime,
        episode,
      },
    });
  };

  const handleImgError = () => {
    anime.image =
      "https://raw.githubusercontent.com/ricemashi/matcha/main/media/no_image.png";
  };

  const toggleBookmark = () => {
    tsvscode.postMessage({
      type: "anime",
      data: {
        command: "toggle_anime_bookmark",
        anime: {
          id: anime.id ?? animeId,
          title: anime.title,
          image: anime.image,
        },
      },
    });
  };

  const dispatch = createEventDispatcher();

  const returnToMenu = () => {
    dispatch("message", {
      command: "return_to_default_sidebar",
    });
  };
</script>

<main class:animeId>
  <Loader {loaded}>
    <div
      class="mb-4 h-72 object-scale-down w-full rounded-md bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 p-1"
    >
      <img
        src={`${anime.image}`}
        alt="anime_image"
        class="object-cover w-full h-full rounded-sm"
        on:error={() => {
          handleImgError();
        }}
      />
    </div>
    <h1 class="text-center text-lg font-bold mb-1">{anime.title}</h1>

    <div class="my-4 flex flex-col gap-2 h-72 overflow-y-scroll scrollbar-hide">
      {#each anime.episodes as episode}
        <div>
          <a
            on:click={() => openAnimeEpisode(episode)}
            href="/"
            class=" text-base font-light hover:text-green-400"
            >{episode.title}</a
          >
        </div>
      {/each}
    </div>

    <Button
      extraStyle="my-2"
      variant="accent"
      on:click={() => openAnimeEpisode(anime.episodes.at(0))}
      >First Episode</Button
    >
    <Button
      extraStyle="my-2"
      variant="accentTwo"
      on:click={() => openAnimeEpisode(anime.episodes.at(-1))}
      >Latest Episode</Button
    >

    <!-- <Button
      extraStyle="my-2"
      variant={isBookmarked ? "accentTwo" : "secondary"}
      on:click={toggleBookmark}
      >{isBookmarked ? "Remove Bookmark" : "Add Bookmark"}</Button
    > -->

    <Button extraStyle="my-2" variant="secondary" on:click={returnToMenu}
      >Back to Main</Button
    >
  </Loader>
</main>
