<script lang="ts">
  import { page } from '$app/stores'
  import { browser } from '$app/environment'
  import { fade } from 'svelte/transition'
  import * as flags from '$lib/flags'

  const code = browser ? $page.url.searchParams.get('c') : ''
  let status = 'joining'
  let statusError = ''
  let showStatus = true
  let pc: RTCPeerConnection

  let localVideo: HTMLVideoElement

  if (!code) {
    status = 'waiting'
  } else if (code.length == 16) {
    if (browser) {
      const ws = new WebSocket(`wss://cosmos.ryanis.cool/signal?room=${code}`)
      ws.addEventListener('message', (e) => {
        const message = JSON.parse(e.data)
        console.log(message)
        if (message.type == 'room') {
          status = 'joined'
          setTimeout(() => (showStatus = false), 1000)
          connectStream(ws)
        } else if (message.type == 'full') {
          status = 'full'
        } else if (message.type == 'candidate') {
          pc.addIceCandidate(
            new RTCIceCandidate({
              sdpMLineIndex: message.label,
              candidate: message.candidate,
            })
          )
        } else if (message.type == 'answer') {
          pc.setRemoteDescription(new RTCSessionDescription(message))
        }
      })
    }
  } else {
    status = 'invalid'
  }

  async function connectStream(ws: WebSocket) {
    if (!window.navigator.mediaDevices?.getUserMedia) {
      statusError = 'nomedia'
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia(
        flags.noUMR
          ? {
              video: { facingMode: 'environment' },
              audio: false,
            }
          : {
              video: {
                facingMode: 'environment',
                frameRate: { ideal: 24 },
                width: { min: 480, ideal: 1280, max: 1920 },
                height: { min: 480, ideal: 720, max: 1080 },
              },
              audio: false,
            }
      )
    } catch (e) {
      statusError = 'mediaerror'
      return
    }
    localVideo.srcObject = stream

    pc = new RTCPeerConnection()
    pc.onicecandidate = (event) => {
      console.log('icecandidate event: ', event)
      if (event.candidate) {
        ws.send(
          JSON.stringify({
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate,
          })
        )
      } else {
        console.log('End of candidates.')
      }
    }

    stream.getTracks().forEach((t) => pc.addTrack(t, stream))
    pc.getSenders().forEach((s) => {
      console.log('Sender', s)
      const params = s.getParameters()
      console.log('params', params)
      params.encodings.forEach((e) => (e.maxFramerate = 24))
      params.degradationPreference = flags.rtcb ? 'balanced' : 'maintain-resolution'
      s.setParameters(params)
    })
    pc.createOffer().then(
      (sessionDescription) => {
        pc.setLocalDescription(sessionDescription)
        ws.send(JSON.stringify(sessionDescription))
      },
      () => {
        console.log('failed to create session description')
      }
    )
    console.log('Created RTCPeerConnnection')
  }
</script>

{#if showStatus || statusError}
  <div class="absolute fixed top-0 text-center left-0 right-0" out:fade={{ duration: 800 }}>
    <div class="inline-block rounded-b-2 bg-slate-800 text-white px-10 py-1" class:statusError>
      {#if statusError == 'mediaerror'}
        You'll need to allow this page to use your camera. If you've already done so, check that your
        browser app has permission to use the camera.
      {:else if statusError == 'nomedia'}
        Your browser does not support using the camera. Please try using a different browser.
      {:else}
        {status}
      {/if}
    </div>
  </div>
{/if}
<div class="absolute fixed bottom-0 text-center left-0 right-0">
  <div class="inline-block rounded-t-2 bg-slate-800 text-white px-10 py-2">
    Position the checkerboard fully within the camera view
  </div>
</div>

<video bind:this={localVideo} autoplay muted playsinline />

<style>
  :global(body) {
    background: #000;
  }

  :global(html, body, body > div) {
    width: 100%;
    height: 100%;
  }

  video {
    object-fit: contain;
    max-height: 100%;
    margin: 0 auto;
  }

  .statusError {
    --at-apply: 'bg-red-700';
  }
</style>
