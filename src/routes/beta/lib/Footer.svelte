<script>
  import { mdiCodeTags, mdiHeartOutline, mdiKeyboardOutline } from '@mdi/js'
  import Icon from '$lib/presentation/Icon.svelte'
</script>

<p class="mb-2">
  Made with <Icon path={mdiCodeTags} class="inline" size="20px" />, <Icon
    path={mdiKeyboardOutline}
    class="inline"
    size="20px"
  /> and <Icon path={mdiHeartOutline} class="inline" size="20px" /> by
  <a class="hover:text-teal-500 dark:hover:text-teal-300" href="https://github.com/rianadon"
    >@rianadon</a
  >.
</p>
<p class="mb-2 text-gray-500 dark:text-gray-400">
  Special thanks to everyone who has made the Dactyl keyboard possible. View a list of <a
    class="darka"
    href="https://github.com/rianadon/dactyl-configurator/blob/main/RESOURCES.md"
    >thanks and inspiration</a
  >.
</p>
<p class="mb-2 text-gray-500 dark:text-gray-400">
  You can find this website's source on <a href="https://github.com/rianadon/Cosmos-Keyboards/"
    >GitHub</a
  >. It's licensed under the
  <a href="https://github.com/rianadon/Cosmos-Keyboards/blob/main/LICENSE">AGPL</a>.
</p>
<p class="mb-2 text-gray-500 dark:text-gray-400">
  Questions? Feedback? Post them on the <a href="https://discord.gg/nXjqkfgtGy">Discord server</a>.
</p>

<style>
  a {
    --at-apply: 'hover:text-teal-300 dark:hover:text-teal-500 underline';
  }
</style>
