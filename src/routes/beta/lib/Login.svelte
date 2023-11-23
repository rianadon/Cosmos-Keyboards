<script lang="ts">
  import Icon from '$lib/presentation/Icon.svelte'
  import * as mdi from '@mdi/js'
  import Dialog from './dialogs/Dialog.svelte'
  import SponsorConditional from '$lib/presentation/SponsorConditional.svelte'
  import * as login from './login'
  import { onDestroy } from 'svelte'
  import { user, theme } from '$lib/store'
  import * as flags from '$lib/flags'

  type State = 'login' | 'email' | 'verify' | 'pay' | 'sponsor'
  let state: State = 'login'
  let error = ''
  let email = ''
  let code = ''
  let timer = 0

  onDestroy(() => clearInterval(timer))

  function updateUser(u: login.User) {
    user.set(u)

    if (u.success && u.method == 'Email') state = 'pay'
    if (u.success && u.method == 'GitHub') state = 'sponsor'
    return u
  }

  function refreshUser() {
    promise = login.getUser().then(updateUser)
  }

  let promise = login.getUser().then(updateUser)
  export let dialogOpen = false

  function verifyEmail(ev: SubmitEvent) {
    ev.preventDefault()
    error = ''
    login.sendVerificationEmail(email).then(
      () => {
        state = 'verify'
      },
      (e) => {
        if (e instanceof login.UserError) error = e.message
        else error = 'Could not send a verification email.'
      }
    )
  }

  function verifyCode(ev: SubmitEvent) {
    ev.preventDefault()
    error = ''
    login
      .verifyEmailCode(code)
      .then((u) => {
        promise = Promise.resolve(u).then(updateUser)
        return promise
      })
      .then(() => (state = 'pay'))
      .catch((e) => {
        if (e instanceof login.UserError) error = e.message
        else error = 'Could not verify the code.'
      })
  }

  function updateOnWindowClose(newWin: Window) {
    timer = window.setInterval(() => {
      if (newWin!.closed) {
        clearInterval(timer)
        refreshUser()
      }
    }, 1000)
  }

  function githubLogin() {
    updateOnWindowClose(login.openLoginWin()!)
  }

  function checkout() {
    updateOnWindowClose(login.openStripeWin()!)
  }

  async function logout() {
    await login.logoutUser()
    refreshUser()
    state = 'login'
  }

  function openDialog() {
    dialogOpen = true
    if (state == 'verify' || state == 'email') state = 'login'
  }

  function cleanPaste(event: ClipboardEvent) {
    /** @ts-ignore */
    let paste = (event.clipboardData || window.clipboardData).getData('text') as string
    code = paste.trim().substring(0, 5)
    event.preventDefault()
  }
</script>

{#await promise}
  ...
{:then}
  <SponsorConditional userPromise={promise}>
    <button class="pro button" slot="yes" on:click={openDialog}>
      <Icon path={mdi.mdiCheck} size="20px" class="text-teal-500" />
      PRO
    </button>
    <button class="button" slot="no" on:click={openDialog}>
      <Icon path={mdi.mdiStarShooting} size="20px" class="text-yellow-500 dark:text-yellow-300" />
      Get PRO
    </button>
  </SponsorConditional>
{:catch}
  <button class="button" on:click={openDialog}>
    <Icon path={mdi.mdiStarShooting} size="20px" class="text-yellow-500 dark:text-yellow-300" />
    Get PRO
  </button>
{/await}

{#if dialogOpen}
  <Dialog on:close={() => (dialogOpen = false)}>
    <SponsorConditional slot="title" userPromise={promise}>
      <span slot="no">Support Cosmos with PRO</span>
      <span slot="yes">Thank You For Your Support!</span>
    </SponsorConditional>
    <div slot="content" class="text-gray-900 dark:text-gray-100">
      {#await promise}
        Please wait as your information is refreshed...
      {:then user}
        {#if user.success && user.user}
          <div
            class="flex items-center justify-between mb-4 border-2 border-gray-100 dark:border-gray-700"
          >
            <span class="px-2">You have logged in via {user.method}.</span>
            <div class="flex rounded-l bg-gray-100 items-center dark:bg-gray-700">
              {#if user.user.avatarUrl}
                <img class="w-8 h-8 rounded" src={user.user.avatarUrl} alt="avatar" />
              {:else}
                <div
                  class="rounded w-8 h-8 flex justify-center items-center bg-gray-500 text-gray-100 dark:bg-gray-300 dark:text-gray-700"
                >
                  <Icon path={mdi.mdiEmailVariant} size="24px" />
                </div>
              {/if}
              <span class="px-2">{user.user.login}</span>
            </div>
          </div>
        {/if}
      {/await}
      <SponsorConditional userPromise={promise}>
        <div slot="no" class="text-center">
          <!-- <p class="mb-4 font-semibold text-lg">Unlock more customization options with <span class="text-teal-500 dark:text-teal-400 font-bold">PRO</span>.</p> -->
          {#if state == 'login'}
            Access all features forever for <span class="font-semibold">$10 USD</span>, paid once.
            <div class="info">
              <div class="info-div"><Icon size="24" path={mdi.mdiToolboxOutline} /></div>
              <p class="info-p">
                A PRO account lets download models with Cosmos's specialties: rounded case designs
                and form-fitting wrist rests.
              </p>
            </div>
            <div class="info">
              <div class="info-div"><Icon size="24" path={mdi.mdiCreditCardLockOutline} /></div>
              <p class="info-p">
                Your payment information is processed securely by Stripe. You can alternatively
                sponsor me on GitHub to access PRO.
              </p>
            </div>
            <div class="info">
              <div class="info-div"><Icon size="24" path={mdi.mdiPiggyBankOutline} /></div>
              <p class="info-p">
                The revenue goes straight into continuing building tools to push the boundaries of
                ergonomic keyboard design.
              </p>
            </div>
            <p class="mt-4">To purchase PRO, please first verify your email address.</p>
            <p class="mb-4">
              Alternatively, you can <a
                class="link"
                href="https://github.com/sponsors/rianadon?frequency=one-time"
                target="_blank"
                rel="noreferrer">sponsor me through GitHub</a
              > then sign in.
            </p>
          {/if}
          {#await promise then user}
            {#if state == 'login'}
              <button
                on:click={() => (state = 'email')}
                class="inline-flex items-center gap-2 bg-teal-400/20 border-2 border-teal-400 px-4 py-1 rounded hover:bg-teal-400/60 hover:shadow-md hover:shadow-teal-400/30 transition-shadow mx-2 mb-2"
              >
                <Icon
                  path={mdi.mdiEmailVariant}
                  size="24"
                  class="text-teal-500 dark:text-teal-300"
                />Sign Up / Log In with Email
              </button>
              <button
                class="inline-flex items-center gap-2 bg-gray-100 dark:bg-transparent dark:border-2 dark:border-gray-500 hover:bg-teal-400/30 dark:hover:bg-teal-700 hover:dark:border-teal-700 py-1 px-4 rounded mb-2 mx-2 dark:text-gray-200"
                on:click={githubLogin}
              >
                <Icon path={mdi.mdiGithub} class="dark:text-gray-300" size="24" />
                Log In with GitHub
              </button>
            {:else if state == 'sponsor'}
              <p>The system was unable to find a record of a GitHub sponsorship.</p>
              <p class="mt-1 text-sm opacity-70">
                Make sure you've selected one of the tiers that mention Cosmos.
              </p>
              <p class="mt-1 text-sm opacity-70 max-w-[30rem] mx-auto">
                If you have sponsored me on GitHub and this message is in error, please <a
                  class="link"
                  href="mailto:ryan@ryanis.cool">get in touch</a
                > so I can give you your well-deserved access.
              </p>

              <p class="mt-4 mb-4 max-w-[32rem] mx-auto">
                If you haven't yet sponsored me on GitHub, visit the <a
                  class="link"
                  href="https://github.com/sponsors/rianadon?frequency=one-time"
                  target="_blank"
                  rel="noreferrer">sponsors page</a
                > (link opens in a new tab). Then refresh your user information.
              </p>
              <button class="preset" on:click={refreshUser}>Refresh User Information</button>
            {:else}
              <div class="heading" class:active={state == 'email'}>
                <Icon path={mdi.mdiNumeric1Box} class="opacity-80" /> Send Verification Email
              </div>
              {#if state == 'email'}
                <p class="mt-4">
                  Please enter your email address below. You will be sent a login code.
                </p>
                <p class="mt-1 text-sm opacity-70">
                  The code will be valid for 10 minutes and will only be accepted on this device.
                </p>
                <p class="mt-1 text-sm opacity-70">
                  You'll use this email address to log in again in the future.
                </p>
                {#if error}
                  <p class="text-red-500 dark:text-red-400 mt-4">Error: {error}</p>
                {/if}
                <form class="flex items-center justify-center mt-4 mb-8" on:submit={verifyEmail}>
                  <!-- svelte-ignore a11y-autofocus-->
                  <input
                    bind:value={email}
                    name="email"
                    type="email"
                    class="input"
                    autocomplete="email"
                    autofocus
                  />
                  <button type="submit" class="preset">
                    <Icon
                      path={mdi.mdiEmailVariant}
                      size="24"
                      class="text-teal-500 dark:text-teal-300"
                    />Verify <span class="hidden sm:inline">Email</span>
                  </button>
                </form>
              {/if}
              <div class="heading" class:active={state == 'verify'}>
                <Icon path={mdi.mdiNumeric2Box} class="opacity-80" /> Confirm Email
              </div>
              {#if state == 'verify'}
                <p class="mt-4">Please enter the code sent to {email}.</p>
                <p class="mt-1 text-sm opacity-70">
                  It may take a minute for your email inbox to receive the code.
                </p>
                {#if error}
                  <p class="text-red-500 dark:text-red-400 mt-4">{error}</p>
                {/if}
                <form class="flex items-center justify-center mt-4 mb-8" on:submit={verifyCode}>
                  <!-- svelte-ignore a11y-autofocus -->
                  <input
                    bind:value={code}
                    type="text"
                    class="input short font-mono tracking-widest"
                    maxlength="5"
                    autofocus
                    autocomplete="one-time-code"
                    spellcheck="false"
                    on:paste={cleanPaste}
                  />
                  <button type="submit" class="preset">
                    <Icon
                      path={mdi.mdiAlphabetical}
                      size="24"
                      class="text-teal-500 dark:text-teal-300"
                    />Verify Code
                  </button>
                </form>
              {/if}
              <div class="heading" class:active={state == 'pay'}>
                <Icon path={mdi.mdiNumeric2Box} class="opacity-80" /> Purchase Pro {#if !user.success}(If
                  you have not already){/if}
              </div>
              {#if state == 'pay'}
                <p class="mt-4">Click the button below to purchase Pro through Stripe.</p>
                <p class="mt-1 text-sm opacity-70">The checkout page will open in a new tab.</p>
                <button
                  on:click={checkout}
                  class="mt-4 mb-4 inline-flex items-center gap-2 bg-yellow-400/10 border-2 border-yellow-400 px-3 py-1.5 rounded hover:bg-yellow-400/60 hover:shadow-md hover:shadow-yellow-400/30 transition-shadow"
                >
                  <Icon
                    path={mdi.mdiCartOutline}
                    size="24"
                    class="text-yellow-500 dark:text-yellow-300"
                  />Purchase
                </button>
              {/if}
            {/if}
            {#if user.success}
              <div class="mt-4">
                If you need to log out, click the log out button.
                <button class="preset mt-2 ml-3" on:click={logout}>Log Out</button>
              </div>
            {/if}
          {:catch}
            <p class="text-red-500">Sorry. There is currently an issue with login.</p>
            <p class="text-red-500">Please check back later to see if the issue is resolved.</p>
          {/await}
          <hr class="border-gray-200 dark:border-gray-700 mt-6 mb-4" />
          <div class="dark:text-gray-300 text-xs">
            <p class="mb-2">
              If there are any payment issues, please <a class="link" href="mailto:ryan@ryanis.cool"
                >email me</a
              > with any relevant details.
            </p>
            <p class="">
              If you log in through GitHub, the server processes only your GitHub username.<br />No
              other account data is requested or stored on the server.
            </p>
          </div>
        </div>
        <div slot="yes" class="text-center">
          <div
            class="bg-[url(/thanks-light.jpg)] dark:bg-[url(/thanks-dark.jpg)] aspect-[2/1] bg-center bg-contain bg-no-repeat w-[80%] mx-auto"
          />
          {#if flags.theme}
            <p class="mb-2 opacity-80">
              As an bonus for supporting the generator, you can now change the color theme of the
              model.
            </p>
            <div class="text-center mb-4">
              Select Theme: <div class="inline-block relative">
                <select class="input long pl-2 pr-8" bind:value={$theme}>
                  <option value="purple">Cosmic Pink</option>
                  <option value="green">Galactic Green</option>
                  <option value="frost">Interstellar Ice</option>
                  <option value="yellow">Solar Sunflower</option>
                </select>
                <div
                  class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-700 dark:text-gray-100"
                >
                  <Icon path={mdi.mdiChevronDown} size="20px" />
                </div>
              </div>
            </div>
          {/if}
          <p class="opacity-80">If you need to log out, click the button below.</p>
          <button class="preset mt-2" on:click={logout}>Log Out</button>
        </div>
      </SponsorConditional>
    </div>
  </Dialog>
{/if}

<style>
  .button {
    --at-apply: 'flex items-center gap-2 border-2 px-3 py-1 rounded hover:shadow-md transition-shadow';
  }

  .button.pro {
    --at-apply: 'border-teal-400 hover:shadow-teal-400/30';
  }

  .button:not(.pro) {
    --at-apply: 'border-yellow-400 hover:bg-yellow-400/30 hover:shadow-yellow-400/30  mt-6 sm:mt-0 sm:ml-2';
  }

  .preset {
    --at-apply: 'bg-[#99F0DC] dark:bg-teal-900/70 hover:bg-teal-400 dark:hover:bg-teal-700 dark:text-white py-1 px-4 rounded focus:outline-none border border-transparent focus:border-teal-500 inline-flex items-center gap-2';
  }

  .link {
    --at-apply: 'text-teal-500 dark:text-teal-400 hover:underline';
  }

  .input {
    --at-apply: 'focus:border-teal-500 border border-transparent text-gray-700 focus:outline-none';
    --at-apply: 'border-gray-200 dark:border-transparent bg-gray-100 dark:bg-gray-700 dark:text-gray-100';
    --at-apply: 'appearance-none rounded mx-2';
    --at-apply: 'text-ellipsis px-2 py-1 flex-1 max-w-[20rem]';
  }
  .input.short {
    --at-apply: 'max-w-[7rem] px-6';
  }
  .input.long {
    --at-apply: 'max-w-none w-40';
  }

  .info {
    --at-apply: 'flex items-center gap-4 my-3 mx-4';
  }
  .info-div {
    --at-apply: 'w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center flex-none text-teal-500 dark:text-teal-300';
  }
  .info-p {
    --at-apply: 'text-left mr-2 text-sm sm:text-base';
  }

  .heading {
    --at-apply: 'bg-gray-100 dark:bg-gray-900/50 my-1 px-4 py-1 uppercase text-sm text-left rounded text-gray-600 dark:text-gray-300 flex gap-2 items-center';
  }
  .heading.active {
    --at-apply: 'text-teal-600/70 dark:text-teal-300/70';
  }
</style>
