---
title: Database
description: Store and retrieve data from a database
id: db
---

# {{ $frontmatter.title }}

**{{ $frontmatter.description }}**

## Commands

```ts-vue
import { commands } from "{{ typedoc.name }}";
```

<PluginCommands :typedoc="typedoc" />

## Resources

<ul>
  <PluginSourceList :id="$frontmatter.id" />
  <li><a :href="`https://github.com/fastrepl/hypr/tree/main/crates/db-user/src`">Rust data types</a></li>
</ul>

<script setup lang="ts">
  import { useData } from "vitepress";
  import { data } from "../data/typedoc.data.mts";
  const { frontmatter } = useData();
  const typedoc = data[frontmatter.value.id];
</script>
