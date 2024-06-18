<script lang="ts">
  import * as mdi from '@mdi/js'

  export let path: string | undefined = undefined
  export let name: string | undefined = undefined
  export let size: string | number = 20
  export let alt: string | undefined = undefined

  let clazz = ''
  export { clazz as class }

  function pathFromName(icon: string) {
    // prettier-ignore
    switch (icon) {
      case 'switch': return mdi.mdiElectricSwitch
      case 'angle': return mdi.mdiAngleAcute
      case 'numeric': return mdi.mdiNumeric
      case 'usb-port': return mdi.mdiUsbPort
      case 'hand': return mdi.mdiHandBackRightOutline
      case 'hand-left': return mdi.mdiHandBackLeftOutline
      case 'screw': return mdi.mdiScrewMachineFlatTop
      case 'knob': return mdi.mdiBlurRadial
      case 'add-extra': return mdi.mdiShapePlusOutline
      case 'pcb': return mdi.mdiPuzzleOutline
      case 'diode': return mdi.mdiRectangleOutline
      case 'unibody': return mdi.mdiTableMergeCells
      case 'kb': return mdi.mdiKeyboardOutline
      case 'kb-left': return 'M9 5A2 2 0 007 7V17A2 2 0 009 19H17V17H9V7H17V5H9M10 8V10H12V8H10M13 8V10H15V8H13M16 8V10H17V8H16M10 11V13H12V11H10M13 11V13H15V11H13M16 11V13H17V11H16V13 11M13 14V16H17V14H13Z'
      case 'angle-rotate': return 'M5 20V4.09L19.57 14.18 18.43 15.82 11.87 11.28C11.04 12.89 9.38 14 7.46 14 7.3 14 7.15 14 7 13.97V20H5M7 7.91V11.96C7.15 12 7.3 12 7.46 12 8.72 12 9.78 11.24 10.22 10.14L7 7.91Z' ;
      case 'row': return 'M22,14A2,2 0 0,1 20,16H4A2,2 0 0,1 2,14V10A2,2 0 0,1 4,8H20A2,2 0 0,1 22,10V14M4,14H8V10H4V14M10,14H14V10H10V14M16,14H20V10H16V14Z'
      case 'column': return 'M14 2A2 2 0 0116 4L16 20A2 2 0 0114 22L10 22A2 2 0 018 20L8 4A2 2 0 0110 2L14 2M14 20 14 16 10 16 10 20 14 20M14 14 14 10 10 10 10 14 14 14M14 8 14 4 10 4 10 8 14 8Z'
      case 'expand-horizontal': return 'M9,11H15V8L19,12L15,16V13H9V16L5,12L9,8V11M2,20V4H4V20H2M20,20V4H22V20H20Z'
      case 'expand-vertical': return 'M13 9 13 15 16 15 12 19 8 15 11 15 11 9 8 9 12 5 16 9 13 9M4 2 20 2 20 4 4 4 4 2M4 20 20 20 20 22 4 22 4 20'
      case 'row-curve': return 'M.333 14.475A1.5 1.5 0 0 1 .333 12.354 1.5 1.5 0 0 1 2.454 12.354C2.617 12.516 2.737 12.707 2.808 12.919L8.033 12.912 8.111 12.354C5.671 11.696 3.331 10.402 1.393 8.464L.708 7.736 2.129 6.315 2.808 7.05C4.632 8.875 6.873 10.055 9.2 10.558A3.96 3.96 0 0 1 14.8 10.558C17.127 10.055 19.368 8.875 21.192 7.05L21.871 6.315 23.292 7.736 22.607 8.464C20.669 10.402 18.329 11.696 15.889 12.354L15.967 12.912 21.192 12.919C21.263 12.707 21.383 12.516 21.546 12.354A1.5 1.5 0 0 1 23.667 12.354 1.5 1.5 0 0 1 23.667 14.475 1.5 1.5 0 0 1 21.546 14.475C21.383 14.312 21.263 14.121 21.192 13.909L15.967 13.916C15.868 14.765 15.479 15.592 14.828 16.243A4 4 0 0 1 9.172 16.243C8.521 15.592 8.132 14.765 8.033 13.916L2.808 13.909C2.737 14.121 2.617 14.312 2.454 14.475A1.5 1.5 0 0 1 .333 14.475M10.586 14.828A2 2 0 0 0 13.414 14.828 2 2 0 0 0 13.414 12 2 2 0 0 0 10.586 12 2 2 0 0 0 10.586 14.828Z'
      case 'column-curve': return 'M9.525.333A1.5 1.5 0 0 1 11.646.333 1.5 1.5 0 0 1 11.646 2.454C11.484 2.617 11.293 2.737 11.081 2.808L11.088 8.033 11.646 8.111C12.304 5.671 13.598 3.331 15.536 1.393L16.264.708 17.685 2.129 16.95 2.808C15.125 4.632 13.945 6.873 13.442 9.2A3.96 3.96 0 0 1 13.442 14.8C13.945 17.127 15.125 19.368 16.95 21.192L17.685 21.871 16.264 23.292 15.536 22.607C13.598 20.669 12.304 18.329 11.646 15.889L11.088 15.967 11.081 21.192C11.293 21.263 11.484 21.383 11.646 21.546A1.5 1.5 0 0 1 11.646 23.667 1.5 1.5 0 0 1 9.525 23.667 1.5 1.5 0 0 1 9.525 21.546C9.688 21.383 9.879 21.263 10.091 21.192L10.084 15.967C9.235 15.868 8.408 15.479 7.757 14.828A4 4 0 0 1 7.757 9.172C8.408 8.521 9.235 8.132 10.084 8.033L10.091 2.808C9.879 2.737 9.688 2.617 9.525 2.454A1.5 1.5 0 0 1 9.525.333M9.172 10.586A2 2 0 0 0 9.172 13.414 2 2 0 0 0 12 13.414 2 2 0 0 0 12 10.586 2 2 0 0 0 9.172 10.586Z'
      case 'wire': return 'M19.8 5V12 17.3C19.8 18.6 19 21.1 16 21.1H14.5C14.9 20.7 15.3 20.2 15.5 19.6H16C18.1 19.6 18.2 17.7 18.2 17.4V12 3H19.5M14.8 18.2C14.8 19.7 13.6 21 12 21H8C5 21 4.2 18.5 4.2 17.2V12 3H5.5V12 17.3C5.8 17.7 5.9 19.5 8 19.5H9.6C9.4 19.1 9.3 18.7 9.3 18.3V8.3C9.3 6.8 10.5 5.5 12.1 5.5S14.8 6.7 14.8 8.3M13.2 8.2C13.2 7.6 12.7 7 12 7S10.8 7.6 10.8 8.2V18.2C10.8 18.9 11.4 19.4 12 19.4S13.2 18.8 13.2 18.2V8.2Z'
      case 'hotswap': return mdi.mdiSquareCircleOutline
      case 'led': return mdi.mdiLedOutline
      case 'trackball': return mdi.mdiCircleSlice8
      case 'oled': return mdi.mdiCellphone
      case 'microcontroller': return mdi.mdiMemory
      case 'bulge': return "M5.62 3C7.13 5.27 8 8.55 8 12 8 15.44 7.13 18.72 5.62 21L4 19.96C5.26 18.07 6 15.13 6 12 6 8.87 5.26 5.92 4 4.03L5.62 3M18.38 3 20 4.04C18.74 5.92 18 8.87 18 12 18 15.13 18.74 18.08 20 19.96L18.38 21C16.87 18.73 16 15.45 16 12 16 8.55 16.87 5.27 18.38 3Z"
          // From simpleicons
      case 'discord': return 'M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z'
          // From simpleicons
      case 'github': return 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12'
      case 'movex': return mdi.mdiAxisXArrow
      case 'movey': return mdi.mdiAxisYArrow
      case 'movez': return mdi.mdiAxisZArrow
      case 'rotatex': return mdi.mdiAxisXRotateClockwise
      case 'rotatey': return mdi.mdiAxisYRotateClockwise
      case 'rotatez': return mdi.mdiAxisZRotateClockwise
      case 'letter': return mdi.mdiAlphaA
    }
  }
</script>

{#if path}
  <svg viewBox="0 0 24 24" width={size} height={size} class={clazz} aria-label={alt}>
    {#if alt} <title>{alt}</title>{/if}
    <path d={path} fill="currentColor" />
  </svg>
{:else if name == 'shrouding'}
  <!-- From IconPark -->
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 48 48"
    ><g
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="4"
      ><path d="M37 19V37M11 37V44H37V37M11 37H4V12L9 7L16 4H32L39 7L44 12V37H37M11 37V19" /><path
        d="M24 21V44"
      /><path d="M9 7L24 21" /><path d="M16 4L24 21" /><path d="M32 4L24 21" /><path
        d="M39 7L24 21"
      /></g
    ></svg
  >
  <!-- <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 48 48"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M14 37H6V24l5-15l8-5h10l9 5l4 15v13h-8v7H14v-7Zm20-9v9m-20-9v9"/></svg> -->
{:else if name == 'keycap'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={clazz}
    ><path d="M7 3s3 .5 5 .5 5-.5 5-.5l1 9s-3 1-6 1-6-1-6-1l1-9z" /><path
      d="M3.869 8.147l-.862 10.294c-.03.366.04.733.205 1.06l.197.393A2.01 2.01 0 0 0 5.206 21h13.588a2.01 2.01 0 0 0 1.797-1.106l.197-.392c.165-.328.236-.695.205-1.06l-.862-10.295a3.99 3.99 0 0 0-.79-2.068L17 3s-3 .5-5 .5S6.978 3 6.978 3l-2.32 3.08a3.99 3.99 0 0 0-.79 2.067z"
    /><path d="M6 12l-2.5 8M18 12l2.5 8" /></svg
  >
{:else if name == 'keycapsmall'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="-4 -4 32 32"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={clazz}
    ><path d="M7 3s3 .5 5 .5 5-.5 5-.5l1 9s-3 1-6 1-6-1-6-1l1-9z" /><path
      d="M3.869 8.147l-.862 10.294c-.03.366.04.733.205 1.06l.197.393A2.01 2.01 0 0 0 5.206 21h13.588a2.01 2.01 0 0 0 1.797-1.106l.197-.392c.165-.328.236-.695.205-1.06l-.862-10.295a3.99 3.99 0 0 0-.79-2.068L17 3s-3 .5-5 .5S6.978 3 6.978 3l-2.32 3.08a3.99 3.99 0 0 0-.79 2.067z"
    /><path d="M6 12l-2.5 8M18 12l2.5 8" /></svg
  >
{:else if name == 'round-top'}
  <svg viewBox="0 0 24 24" width={size} height={size}
    ><path
      transform="rotate(-45 12 12)"
      d="M19,19H21V21H19V19M19,17H21V15H19V17M3,13H5V11H3V13M3,17H5V15H3V17M3,9H5V7H3V9M3,5H5V3H3V5M7,5H9V3H7V5M15,21H17V19H15V21M11,21H13V19H11V21M15,21H17V19H15V21M7,21H9V19H7V21M3,21H5V19H3V21M21,8A5,5 0 0,0 16,3H11V5H16A3,3 0 0,1 19,8V13H21V8Z"
      fill="currentColor"
    /></svg
  >
{:else if name == 'round-side'}
  <svg viewBox="0 0 24 24" width={size} height={size}
    ><path
      transform="rotate(45 12 12)"
      d="M19,19H21V21H19V19M19,17H21V15H19V17M3,13H5V11H3V13M3,17H5V15H3V17M3,9H5V7H3V9M3,5H5V3H3V5M7,5H9V3H7V5M15,21H17V19H15V21M11,21H13V19H11V21M15,21H17V19H15V21M7,21H9V19H7V21M3,21H5V19H3V21M21,8A5,5 0 0,0 16,3H11V5H16A3,3 0 0,1 19,8V13H21V8Z"
      fill="currentColor"
    /></svg
  >
{:else if name == 'hands'}
  <svg viewBox="0 0 48 24" width={Number(size) * 2} height={size} class={clazz} aria-label={alt}>
    {#if alt} <title>{alt}</title>{/if}
    <path d={mdi.mdiHandBackLeftOutline} fill="currentColor" />
    <path d={mdi.mdiHandBackRightOutline} fill="currentColor" transform="translate(24)" />
  </svg>
{:else if name == 'kbs'}
  <svg viewBox="0 0 36 24" width={Number(size) * 1.5} height={size} class={clazz} aria-label={alt}>
    {#if alt} <title>{alt}</title>{/if}
    <path d={pathFromName('kb-left')} fill="currentColor" transform="translate(-1 0)" />
    <path d={pathFromName('kb-left')} fill="currentColor" transform="translate(37 0) scale(-1 1)" />
  </svg>
{:else if name == 'kb-right'}
  <svg viewBox="-24 0 24 24" width={size} height={size} class={clazz} aria-label={alt}>
    {#if alt} <title>{alt}</title>{/if}
    <path d={pathFromName('kb-left')} fill="currentColor" transform="scale(-1 1)" />
  </svg>
{:else if name}
  <svg viewBox="0 0 24 24" width={size} height={size} class={clazz} aria-label={alt}>
    {#if alt} <title>{alt}</title>{/if}
    <path d={pathFromName(name)} fill="currentColor" />
  </svg>
{:else}
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class={clazz}
  >
    <circle cx="10" cy="10" r="2" fill="currentColor" />
  </svg>
{/if}
