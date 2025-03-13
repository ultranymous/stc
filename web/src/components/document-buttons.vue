<template>
  <nav>
    <div class="flex flex-wrap items-center justify-between mx-auto p-4">
      <div class="w-full md:block">
        <div v-if="is_readable" class="relative rounded-lg border custom-border-color p-6">
          <h2 class="absolute flex top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <span class="custom-bg-main px-2 text-lg font-medium">Open</span>
          </h2>
          <ul class="flex flex-col font-medium p-4 md:p-0 border custom-border-secondary-color rounded-lg bg-transparent md:space-x-8 rtl:space-x-reverse md:flex-row md:mt-0 md:border-0">
            <li v-if="is_readable">
              <router-link
                  :to="reader_view_link"
                  class="flex items-center justify-between w-full py-2 px-3 custom-link rounded md:border-0 md:p-0 md:w-auto">
                Read&nbsp;<book-open-icon class="w-4 h-4"/>
              </router-link>
            </li>
          </ul>
        </div>
        <div v-if="(links.length || 0) > 0" class="relative rounded-lg border custom-border-color p-6 mt-6">
          <h2 class="absolute flex top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <span class="custom-bg-main px-2 text-lg font-medium">Download</span>
          </h2>
          <ul class="flex flex-col font-medium p-4 md:p-0 border custom-border-secondary-color rounded-lg bg-transparent md:space-x-8 rtl:space-x-reverse md:flex-row md:mt-0 md:border-0">
            <li v-for="link of links" v-bind:key="link.name">
              <a :href="`/repo/${link.name}?filename=${generate_filename(document!.title)}.${link.extension()}`"
                 target="_blank"
                 class="flex items-center justify-between w-full py-2 px-3 rounded custom-dropdown-item md:border-0 md:p-0 md:w-auto">
                <span v-html="link.extension().toUpperCase()"/>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import {computed, onMounted, ref} from "vue";
import {Document, Link} from "@/types/index.ts"
import {BookOpenIcon} from '@heroicons/vue/16/solid'
import {generate_filename} from "@/utils.ts";
import {initFlowbite} from "flowbite";
import {db} from "@/database.ts";

const props = defineProps({
  document: undefined as Document,
  links: Array<Link>,
});
const maybe_bookmark = ref(undefined);

const best_reader_link = computed(() => {
  return Link.get_reader_link(props.links)
});

db.bookmarks.get(best_reader_link.value?.name!).then((value) => {
  maybe_bookmark.value = value;
})

const reader_view_link = computed( () => {
  let link = `/reader?nexus_key=${best_reader_link.value.name}&filename=${generate_filename(props.document!.title)}.${best_reader_link.value.name.split(".")[1]}`;
  if (maybe_bookmark.value) {
    link += ('&anchor=' + maybe_bookmark.value.anchor);
  }
  return link;
})

const is_readable = computed(() => {
  return best_reader_link.value && (best_reader_link.value?.extension() === 'djvu' || best_reader_link.value?.extension()  === 'epub')
})

onMounted(async () => {
  initFlowbite()
})
</script>
