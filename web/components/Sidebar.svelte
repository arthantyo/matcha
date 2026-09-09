<script lang="ts">
  import { onMount } from "svelte";
  import DefaultSidebar from "./DefaultSidebar.svelte";
  import MangaSidebar from "./MangaSidebar.svelte";
  import AnimeSidebar from "./AnimeSidebar.svelte";

  let state: "default" | "manga" | "anime" = "default";
  let mangaId = "";
  let animeId = "";

  onMount(async () => {
    window.addEventListener("message", (event) => {
      const msg = event.data;
      switch (msg.type) {
        case "manga_triggered":
          state = "manga";
          mangaId = msg.data.manga_id;
          break;
        case "anime_triggered":
          state = "anime";
          animeId = msg.data.anime_id;
          break;
      }
    });
  });

  const handleEventDispatcher = (event: any) => {
    if (event.detail.command == "return_to_default_sidebar") {
      state = "default";
    }
  };
</script>

<main>
  {#if state == "default"}
    <DefaultSidebar />
  {:else if state == "manga"}
    <MangaSidebar {mangaId} on:message={handleEventDispatcher} />
  {:else if state == "anime"}
    <AnimeSidebar {animeId} on:message={handleEventDispatcher} />
  {/if}
</main>
