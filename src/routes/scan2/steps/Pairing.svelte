<script lang="ts">
  import Step from '../lib/Step.svelte'
  import Qrcode from '../lib/Qrcode.svelte'
  import { pc as storePC, remoteStream, step } from '../store'
  import * as flags from '$lib/flags'

  let pairURL: string
  let status = '[1/5] Connecting to signalling server'

  const ws = new WebSocket('wss://cosmos.ryanis.cool/signal')
  const pc = new RTCPeerConnection()
  storePC.set(pc)

  ws.addEventListener('open', () => {
    status = '[2/5] Waiting for signalling server'
  })
  ws.addEventListener('message', (e) => {
    const message = JSON.parse(e.data)
    // message.room = 'Jd6fd4XmBewjn4R5'
    if (message.type == 'room') {
      status = '[3/5] Waiting to pair'
      pairURL = `https://ryanis.cool/cosmos/pair?c=${message.room}`
      if (flags.noUMR) pairURL += '&,NoUMR,'
      if (flags.rtcb) pairURL += '&,rtcb,'
    }
    if (message.type == 'candidate')
      pc.addIceCandidate(
        new RTCIceCandidate({
          sdpMLineIndex: message.label,
          candidate: message.candidate,
        })
      )
    if (message.type == 'offer') {
      status = '[4/5] Waiting for media track'
      pc.setRemoteDescription(new RTCSessionDescription(message))
      pc.createAnswer().then(
        (sessionDescription) => {
          pc.setLocalDescription(sessionDescription)
          ws.send(JSON.stringify(sessionDescription))
        },
        () => {
          console.log('failed to create session description')
        }
      )
    }
    console.log(message)
  })

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
  let added = false
  pc.addEventListener('track', (event) => {
    status = '[5/5] Connected!'
    console.log('Remote stream added.')
    remoteStream.set({ stream: event.streams[0] })
    if (!added) $step++
    added = true
  })
</script>

<Step>
  <span slot="title">Connect Your Phone</span>
  <div slot="prose">
    <p class="mb-2">
      Your phone likely has the best camera, so let's connect it and use your display for
      localization. The video from your camera is sent directly from your phone to your computer
      over an encrypted peer-to-peer channel using WebRTC.
    </p>
  </div>
  <div slot="content" class="text-center text-gray-200">
    <div class="inline-block w-100 bg-slate-900 rounded-2 p-4 shadow-lg shadow-purple/15">
      {#if pairURL}
        <p class="my-2 mx-2">
          Scan the QR code below. On most phones you can scan a code using the built-in camera app.
        </p>
        <Qrcode style="margin: 1rem auto; border-radius: 0.25rem;" value={pairURL} />
      {/if}
    </div>
    <br />
    <div class="inline-block font-mono m-4 bg-slate-800">
      {status}
    </div>
  </div>
</Step>
