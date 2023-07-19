<script>
	import { base } from '$app/paths';
	import HorizontalFeature from '../lib/horizontal-feature.svelte';
	import VerticalFeature from '../lib/vertical-feature.svelte';

	const discord = 'https://discord.gg/nXjqkfgtGy';
</script>

<svelte:head>
	<title>Cosmos Keyboard</title>
	<link rel="canonical" href="https://ryanis.cool/cosmos/" />
</svelte:head>

<main class="text-center font-sans bg-slate-900 text-white">
	<div class="background" style="background-image: url('{base}/keyboard2.png')">
		<h1
			class="capitalize absolute w-full text-2xl top-[min(calc(20vh-2em),4em)] text-purple font-semibold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-amber-600 tracking-tight"
		>
			A new ergonomic keyboard generator
		</h1>
		<h1 class="sr-only">Cosmos</h1>
	</div>
	<p>Cosmos is not yet ready for release. However, if you'd like to beta test, join the discord.</p>
	<a
		class="inline-block font-sans font-semibold rounded-2 border-3 border-teal-500 px-8 py-2 m-2 mt-6 transition shadow-lg hover:shadow-teal-500/50 hover:scale-105 ease-in-out"
		href={discord}>Join the Discord</a
	>
	<img class="mt-8 h-[4vw]" src="{base}/bg2.png" alt="" />
	<div class="bg-[#003935] p-5">
		<p class="m-auto font-sans max-w-4xl p-8">
			Early this year I printed and made my first keyboard, a Dactyl Manuform. I built <a
				href="https://ryanis.cool/dactyl">an online generator</a
			> to design more of them too. I've been overjoyed seeing the positive reception it's gotten since
			its release, but in building the generator I've seen so many opportunities for improvement. Cosmos
			is my answer to these ideas. A new generator built on a different set of principles, its aim is
			to let you build the most comfortable and beautiful keyboard and celebrate the joy of making yourself.
		</p>
		<div class="md:flex max-w-7xl gap-4 lg:gap-8 m-auto">
			<VerticalFeature src="/positions.mp4">
				<span slot="title"
					>Flexible In <span class="font-bold text-purple">All Dimensions</span></span
				>
				<p slot="content">
					Take control of every key's position. Designing a 3-key macropad? Cosmos will give you a
					fitting case.
				</p>
			</VerticalFeature>
			<VerticalFeature src="/keyboard.mp4">
				<span slot="title"
					>For <span class="font-bold text-emerald">First-Time Pioneers</span> and Seasoned Adventurers</span
				>
				<p slot="content">
					Cosmos will walk you through designing, wiring, and programming your keyboard.
				</p>
			</VerticalFeature>
			<VerticalFeature src="/curves.mp4">
				<span slot="title">As <span class="font-bold text-lightblue">Smooth</span> As Water</span>
				<p slot="content">
					Not only can you replace sharp edges with configurable curves, but the generator runs
					buttery smooth too.
				</p>
			</VerticalFeature>
		</div>
		<p class="text-xs text-white/70 my-6">
			Every frame of the animations above was created with the help of the Cosmos generator. You can
			make any one of these keyboards yourself.
		</p>
	</div>
	<img class="h-[4vw]" src="{base}/bg3.png" alt="" />

	<div class="max-w-5xl m-auto">
		<HorizontalFeature src="/hand.mp4" reversed>
			<span slot="title">A Keyboard for Every Being In the Universe</span>
			<p slot="content">Measure your hand and use it to design the perfect keyboard</p>
			<p slot="description">
				A great ergonomic keyboard should fit your hand shape, but it's difficult iterating through
				prints and testing. Cosmos lets you measure your hand and place it in the editor, allowing
				you to put yourself in the design process.
			</p>
		</HorizontalFeature>
		<HorizontalFeature src="/cosmos.png">
			<span slot="title">Intuitive Controls, Everywhere</span>
			<p slot="content">Play with sliders or code, your choice</p>
			<p slot="description">
				If you've configured a Dactyl keyboard before, the Cosmos generator gives you a familiar set
				of options to adjust. But the true power of the editor lies in Expert mode, where you can
				adjust the position and rotation of every key. Alternatively, take over and code using
				TypeScript to programmatically generate the key layout.
			</p>
		</HorizontalFeature>
		<HorizontalFeature src="/cosmoboard.png" reversed>
			<span slot="title">The Galaxy is the Limit</span>
			<p slot="content">Design anything, as long as it's a keyboard</p>
			<p slot="description">
				The generator isn't limited to keyboards that fit a single adult human hand. Design
				keyboards for babies. Design keyboards for cats. Design keyboards that fit two hands... like
				a normal keyboard. Dream it and with some practice in Expert mode, you can design keyboards
				like the ones on the left in under 5 minutes.
			</p>
		</HorizontalFeature>
		<HorizontalFeature src="/cad.mp4">
			<span slot="title">Compatible With Your 3D Printer And Your CAD Software</span>
			<p slot="content">
				Generate high-quality STLs for printing or STEP files for further editing
			</p>
			<p slot="description">
				Cosmos uses the <a href="https://dev.opencascade.org/">OpenCascade</a> geometry kernel, the
				same kernel that powers <a href="https://www.freecad.org/">FreeCAD</a> and
				<a href="https://cadquery.readthedocs.io/en/latest/#">CadQuery</a>. It can export STEP
				files, making it easy to use Cosmos as a starting point and build your next keyboard in your
				favorite CAD software.
			</p>
		</HorizontalFeature>
	</div>

	<div class="faq my-20 max-w-xl mx-auto px-4">
		<h2
			class="w-full text-2xl top-[min(calc(20vh-2em),4em)] text-purple font-semibold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-amber-600 mb-4"
		>
			FAQ
		</h2>
		<h3 class="font-bold mb-1 mt-8">When is the generator being released?</h3>
		<p>By the end of this summer (but hopefully sooner).</p>
		<p>
			If you don't mind buggy software, join the <a href={discord}>Discord</a> and try the beta!
		</p>
		<h3 class="font-bold mb-1 mt-8">Is the project Open Source?</h3>
		<p>I'm keeping the tool closed-source as I work on it.</p>
		<p>
			I'd like to recoup some of the costs buying keyboard parts, and I'm planning on making the
			curves generation available for a small fee.
		</p>
		<p>Once the project is released, everything else will be open-sourced.</p>
		<h3 class="font-bold mb-1 mt-8">Is it called Cosmos, Cosmos keyboard, or Cosmos generator?</h3>
		<p>
			The real name is actually <span class="italic"
				>Cosmos Keyboard Generator for Keyboards *cough* of the Cosmos.</span
			> But you can call it any of the three.
		</p>
	</div>
	<p class="text-sm mb-10">
		Brought to you by <a href="https://github.com/rianadon">@rianadon</a>.
	</p>
</main>
<img
	style="position: absolute; width: 0; height: 0;"
	alt=""
	aria-hidden="true"
	src="https://pageviews.ryanis.cool/by/cosmos"
/>

<style>
	:global(html) {
		background: rgb(15, 23, 42);
	}

	.background {
		background-size: contain;
		background-repeat: no-repeat;
		background-position: center;
		width: 100%;
		height: calc(90vh - 100px);
		max-height: 600px;
	}

	a[href]:not(.inline-block) {
		color: #f0abfc;
	}

	a[href]:not(.inline-block):hover {
		text-decoration: underline;
	}

	.faq p {
		--at-apply: 'mb-1 <sm:text-sm';
	}
</style>
