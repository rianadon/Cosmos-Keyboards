---
date: 2024-02-26
categories:
    - Technical
---

# Better than CAD Part 1: Thickening Webs

If you followed the [last blog post on offset surfaces](./offset-surfaces-md), you'll know improving part thickness has been a long-time goal of Cosmos. Many times, the naive appoach of lofting the sides of key sockets creates solids too thin to print. Let's discover how the generator fixes these issues!

<!-- more -->

Below you'll see two keys. On the left is the old web. That's what I call that piece of purple-colored material connecting the two keys. It's formed by drawing lines connecting the first key's side to the second key's side. On the right is the new web, with all the changes I'm about to describe applied. Why don't you move the keys around and see how the webs change?

<iframe scrolling="no" style="aspect-ratio: 160 / 50" src="../../embed/thickness" />

In the new web, I've strategically added some extra shapes. The top and bottom surfaces on the key sockets have been extended. This is the new magic that's making the web thicker.

![Added Shapes on the Web](../../assets/thickness-highlight.svg){ width=70% .center}

_I'll pull out my spline toolbox and fix this with some nice curves instead_, I hear you say. _My CAD software can fix this!_ Alright, but how do you ensure your splines never intersect the adjacent keycaps or switches? That the thickness is always consistent? That's the advantage of using these straight lines. Plus, you can always fillet the coners later.

Before diving in, here's a preview of what this post is going to walk through building. On the left is the original web from a keyboard. You can see the socket clipping through the side of the wall. That means the thickness is going negative! On the right is the web automatically generated using these new algorithmic improvements.

## A Tale of Two Lines

The rest of this post is going to be structured as follows:

1. Figure out how big to make these extra shapes, assuming everything is in 2D.
2. Survive the challenge of thickening the web, but in 3D.

Without further ado, let's get mathin'.

![Labeled Points on the Web](../../assets/webmath.png){ width=300 .center}

Here's a diagram of the sockets from the perspective of socket A. I've fixed the location and orientation of the socket to make the math simpler. The socket on top, positioned at the origin (0,0), is the socket by which this extra triangular shape will be added. This new shape is parameterized by only one variable, $o_t$, that controls by how much the top surface is extended.

I'm going to find the slopes of the lines describing the top and bottom of the web. If you survived your math classes, you should remember your fomulas. This line is going from $(o_t, 0)$ to $(p_{btx}, p_{bty})$:

$$
m = m_{bot} = m_{top} = \frac{p_{bty}}{p_{btx} - o_t}
$$

These slopes are equal because the lines are parallel (which gives constant thickness). The nifty trick that'll become apparent soon is that I'll solve for the top and bottom offsets independently. Notice I'm writing the equation of the slope using the top set of points. This means that only one variable, $o_t$, will show up in the equations. If you turned your screen upside-down, you might notice this problem looks pretty similar, except that all the text is unreadable. All this math therefore also applies to finding the offset on the underside.

I write the equations of both lines:

$$
\begin{align*}
\text{top: } y &= m(x - o_t) = mx - mo_t \\
\text{bottom: } y &= mx - t_a
\end{align*}
$$

To know the thickness, I need to measure the distance between the two parallel lines. What's that distance? [Wikipedia has our back!](https://wikipedia.org/wiki/Distance_between_two_parallel_lines). Because the equation for $t_{desired}$ contains absolute values and square roots, I use $(t_{desired})^2$ to make the math nicer .

$$
(t_{desired})^2 = \frac{(t_a - mo_t)^2}{m^2 + 1}
$$

There you have it! To solve for $o_t$, you plug everything into the equation above and solve. As there are some squared terms, you get a quadratic equation.[^1] The solution is pretty big, so I won't write it out. I figure you're already tired of math. Which is why we're about to do more math, because there's one small issue...

[^1]: A quadratic equations! Multiple solutions!? Imaginary solutions!? It's an unforunate situation. If there is no real solution, I use the maximum offset (i.e. how big the offset can get before running into adjacent keycaps or switches). If both solutions are negative, I use half the maximum offset. Zero and the maximum offsets are both reasonable offsets in this case, so I choose both by averaging :D Otherwise, I use the smallest nonnegative solution.

### Avoiding the Keycaps and Switches

There's a limit to how thick the web can be made. If it's too big in spots, it might run into the keycaps! Or it may run into the switches! Neither would be very good.

![Extrapolating the Maximum Top Offset](../../assets/weboffset.png){ width=300 .center}

To find the maximum offsets on the top surfaces of the web, I extend the line that passes through the $p_{bt}$ (the top point on the second socket) and the keycap's corner. In reality, finding this $p_{key}$ point is pretty difficult since keys can be oriented skew. Everything looks nicer in 2D :) Instead, I define $p_{key}$ relative to $p_{bt}$ using the switch's compressed height and offsetting some margin in the horizontal direction.

$$
o_{t,max} = p_{btx} - p_{bty} \frac{p_{keyx} - p_{btx}}{p_{keyy} - p_{bty}}
$$

For points on the bottom surface, the maximum offset is found pretty similarly. However, instead of working with keycaps, I instead project the socket's edge line straight. I also set the lower bound for this offset to be $t_{desired} / 2$ because switches typically don't come lose to the edge of the socket. That way, _some_ material always gets added on the bottom if required.

PICTURE

There's one more check performed to limit the offset: the wall boundary check. If offsetting is going to move a nearby wall, the wall can only be moved so much before it runs into the nearby walls. Therefore, I check that the offset does not lead to any wall intersections, and if it does, I decrease the offset until there are no intersections.

### Conclusion

As you play with the demo above, you'll hopefully see the effects that the keycap and switch avoidance have on the webs. It's a pretty smart algorithm!

I should also note that in all my diagrams, the web thickness matches the sockets thickness. Yet in reality, setting the web thickness to 80% of the socket thickness produces thick enough results but with fewer sharp edges. In expert mode, `webMinThicknessFactor` sets this ratio.

Anyways, that's all find and dandy for a 2D solution---but I've conveniently left out the fact that keyboards are in 3D, keys can be oriented skew to each other, and that the act of adding a line in 2D corresponds to adding a face in 3D. Besides, how do you even determine which sockets are neighbors? What if three keys are laid out in a triangle? Who's neighboring who now, huh?

## All Around Me Are Familar Faces

In Cosmos, the web is computed as many interconnected triangles. Every vertex of a triangle is associated with some corner of a socket. Therefore, every triangle connects 2-3 distinct sockets.

PICTURE WITH TRIANGLE LAYOUT

Why triangles and not, say, quadrilaterals? Not every web can be subdivided into quadrilaterals. Take, for instance, three keys laid out in a triangle. Such a configuration will require a triangle.

### Neighbors all the Way Down

In order to compute thicknesses, we'll need a way to examine a cross section of the web and examine it in 2D, just as described above. One logical point to take this cross section would be along the sides of every socket.

PICTURE

However, this isn't quite the best. Imagine there are two sockets, positioned skewly, such that their corners nearly touch on one side but diverge on the other. In this case, the divergent side should have some thickness added, while the touching side needs no extra material. Because of cases like these, the generator independently considers how much thickness to add for the left and right sides of the socket's edge.

PICTURE

Because of the specific way that the web is computed (article coming soon), every side of every socket has a triangle neighboring it. Two vertices of that triangle belong to this socket, while the third vertex belongs to another socket. This socket makes a pretty good neighbor. But because the thickness for the left and right sides are being considered independently, we have to find a neighboring left and right side of another socket's edge. And using the left and right side of this particular neighbor doesn't always work out.

PICTURE

What's required instead is to consider not only the socket attached to the neighboring triangle, but also sockets attached to neighboring triangles _of the neighboring triangles_. It's neighbors all the way down!

PICTURE

In all, there are 3 pairs of neighbor points to consider in addition to the original neighbor point. To pick which pair is the most logical, I both consider the length between the left and right sides of the socket edge and their corresponding neighbors as well as the ratios between these lengths. A good neighbor should be near-equally spaced from both the left and right side of the socket's edge.

If you're still curious how this works, I suggest you read the `closestPts` implementation in the source code.

After computing the neighbors, we can now look at the two cross sections.

### Adding New Faces

At this point we have two cross sections, and with them we can compute how much each endpoint of the edge needs to be offset. So now, just move the vertices and call it a day right?

_Right?_

_Right?_

PICTURE

This isn't going to work. Moving the vertices creates empty holes around the key socket. Not only will these holes need to be filled with new triangles, but the nearby triangles are going to need to be split to avoid further holes.

PICTURE

In this section I'm going to describe the face-splitting algorithm I developed for Cosmos. It operates on an array of vertices and an array of triangles containing pointers to the vertex array (or more accurately, every triangle records indices into the vertex array). There's a few desirable properties for it to have:

1. If a `vertices[i]`needs to be offset, then `vertices[i]` will be updated with the new vertex location. Then, wall computation will use the new vertex positions.
2. Every original vertex position must still be stored in `vertices`. That is to say, if a vertex is moved, its original location must be pushed to the end of `vertices`. Otherwise, there will be holes in the model.
3. If an edge is split, each face on either side of the edge must be divided into two faces. This also ensures no holes are added.
4. The order through which edges are traversed should have little effect on the resulting model.

The most critical decision in this algorithm is the choice of which edges to split. I choose to split the two edges on the key socket adjacent to the current edge. These edges are spefial in that they only have one adjacent face each, which means only one face per side must be split into two.

The new vertex is shifted into the location of the original vertex, while the original vertex is offset in place. Additionally, the references of vertices in the socket's points are updated so that the next socket edge that is examined has the correct set of points.

PICTURE

### Face Flip

This algorithm produces long thin facse when it splits edges. Sometimes they are desired. Other times, they are not.

PICTURE

The final step of the algorithm is to flip any edges that 1) Don't satisfy the Delaunay condition and for which 2) flipping them increases the bubliness of the model. I'll explain what both of these mean in a moment, but here's what an edge flip does:

PICTURE

The initial web is created a set of points on the corners of sockets via Delaunay triangulation. This algorithm creates triangles such that no point lies within the circumcircle of any triangle. It can also be expressed as that for every edge, the sum of the two angles opposite that edge is always less than 180°. This proprety eliminates many thin triangles and leads to an even, nice-looking mesh. When the Delaunay triangulation is performed, all points are projected to 2D. However, when doing this algorithm I'm working in 3D. So I calculate the angles in 3D to check if an edge is locally Delaunay.

!!! Note

This worked so well that I've added a preprocessing step after the Delaunay that checks the 3D angles and flips any non-locally Delaunay edges. This helps fix some meshes.

PICTURE?

The second check stops us from punching pockets into the model. The goal of this edge flipping step is to remove pockets, not create them.

PICTURE

--8<-- "docs/blog/.footer.md"
