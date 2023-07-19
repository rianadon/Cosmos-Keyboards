<script lang="ts">
	import { SolvedHand, type Hand, type Joints } from './hand';
	import { Canvas, TransformableObject, T } from '@threlte/core';
	import { DEG2RAD } from 'three/src/math/MathUtils';
	import { Line2 } from '@threlte/core';
	import { Vector3, type Vector3Tuple, Matrix4 } from 'three';
	import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial';
	import { HTML } from '@threlte/extras';

	export let hand: Hand | undefined;
	export let joints: Joints | undefined;
	export let color: string;
	export let width: number;

	let lines2D: Vector3Tuple[][] = [];
	let points2D: Vector3Tuple[] = [];
	let info: { position: Vector3; text: string }[] = [];

	function to2D(x: number, v: Vector3) {
		return [x, v.x, v.z] as Vector3Tuple;
	}

	$: if (hand && joints) {
		const solved = new SolvedHand(joints, new Matrix4().makeTranslation(-10, 0, 0));
		const positions = solved.worldAllPositions();

		lines2D = Object.values(positions).map((p) => p.map((v) => to2D(0, v)));
		points2D = lines2D.flat();

		info = Object.entries(hand.limbs).flatMap(([limb, vectors]) => {
			return vectors.map((_, i) => {
				const avg = new Vector3()
					.addScaledVector(positions[limb][i], 0.3)
					.addScaledVector(positions[limb][i + 1], 0.7);
				return {
					position: new Vector3(...to2D(1, avg)),
					text: (joints![limb][i].length * 100).toFixed(2) + 'cm'
				};
			});
		});
	}
</script>

<Canvas shadows={false}>
	<T.OrthographicCamera makeDefault position={[60, 0, 0]} zoom={width / 25} let:ref={cam}>
		<TransformableObject object={cam} lookAt={{ y: 0 }} />
	</T.OrthographicCamera>

	<T.Group>
		{#each lines2D as line}
			<Line2
				points={line}
				material={new LineMaterial({ color: 0x1e293b, worldUnits: true, linewidth: 0.5 })}
			/>
		{/each}
		{#each points2D as pt}
			<T.Mesh position={pt}>
				<T.SphereGeometry args={[0.5]} />
				<T.MeshBasicMaterial {color} />
			</T.Mesh>
		{/each}
		{#each info as inf}
			<HTML position={inf.position} rotation={{ y: DEG2RAD * 90 }} transform>
				<div style="height: 1em; font-size: 2em; text-align: center">{inf.text}</div>
			</HTML>
		{/each}
	</T.Group>
</Canvas>
