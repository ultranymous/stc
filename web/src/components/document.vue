<template>
<div class="base-text-color">
  <div class="leading-tight tracking-tight secondary-text-color custom-link-container" v-html="document?.format_coordinates()"/>
  <div class="leading-tight tracking-tight secondary-text-color custom-link-container" v-html="document?.extras()"/>
  <h3 class="text-2xl mt-2 leading-tight tracking-tight custom-header" v-html="document?.title" />
  <img v-if="cover" class="mt-3 object-cover border p-2 rounded custom-border-color w-40" :src="cover" alt="Book cover" />
  <p class="mt-2 custom-md" v-html="rendered_abstract" />
  <tags-list class="mt-4" :tags="document?.tags" />
  <hr class="custom-separator" />
  <div class="mt-4">
    <document-buttons :document="document" :links="links"/>
  </div>
</div>
</template>

<script setup lang="ts">
import {onMounted, ref} from "vue";
import {Document, Link} from "@/types";
import DocumentButtons from "@/components/document-buttons.vue";
import TagsList from "@/components/tags-list.vue";

const props = defineProps({
  document: Document,
});
const links = ref([])

const cover = ref(undefined as string | undefined);
const rendered_abstract = window.render(props.document?.abstract);

async function check_repository(name: string) {
  try {
    const response = await fetch(`/repo/${name}`, { method: 'HEAD' });
    if (response.ok) {
      const discovered_link = new Link({name: name});
      links.value.push(discovered_link)
    }
  } catch (e) {
    return;
  }
}

onMounted(async () => {
  for (const extension of ["pdf", "epub", "djvu"]) {
    check_repository(`${props.document.id}.${extension}`)
  }
})
</script>
