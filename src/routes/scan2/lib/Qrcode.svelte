<script lang="ts">
  import Qrious from 'qrious'

  const QRcode = new Qrious()

  export let level = 'L'
  export let background = '#fff'
  export let foreground = '#000'
  export let size = 200
  export let value = ''
  export let padding = null
  export let style = ''

  let image = ''

  $: {
    QRcode.set({
      background,
      foreground,
      level,
      padding,
      size,
      value,
    })
    image = QRcode.toDataURL('image/png')
  }
</script>

<img src={image} alt={value} class="qrcode" {style} />

<style>
  .qrcode {
    image-rendering: pixelated;
  }
</style>
