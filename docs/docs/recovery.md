# Help! I've Lost My Model's URL

It happens. You opened Cosmos in incognito mode. You made your dream keyboard, clicked download, printed the model, then realized it doesn't quite fit right. The thumb cluster just needs a little tweak, but you've closed the tab. It's not in your history anymore. You never saved the URL. You're in distress. You spent fifty hours on this keyboard but all you have is this dumb STL file.

Don't fear, because let me tell you, there's a way. All you have to do is drag that STL or STEP file into the box below to find the link to your model.

<iframe scrolling="auto" style="height: 17rem" src="../../embed/recover" />

## URL in the STEP File

If you don't feel like using this tool (you're missing out if you don't!), you can alternatively open the STEP file with a text editor to find the model URL. It'll be inserted into the `FILE_NAME` field on the fourth line.

```step linenums="1" hl_lines="4"
ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('Cosmos Model'),'2;1');
FILE_NAME('https://ryanis.cool/cosmos/beta#cf:ChYIAxAEWAAYBCAFKNcBMM0BUA…
  '2024-02-07T20:50:33', ('Author'),('Open CASCADE'),
  'Open CASCADE STEP processor 7.6','Open CASCADE 7.6','Unknown');
```

## URL in the STL File

Cosmos exports STLs in binary format, which is a compact representation designed to fit your model into the smallest possible file. There isn't much space to fit the URL inside.

Luckily, the Binary STL specification leaves 2 bytes (the _attribute byte count_) for custom information at the end of every triangle. Some CAD applications actually use these bytes to add color information to every triangle. However, Cosmos uses these bytes to store the URL information. Typically the STL files have thousands if not tens of thousands of triangles, which gives plenty of bytes for URL-encoding.

!!! Info "STLs? Triangles? What?"

    The STL file format encodes models using many, many triangles. A simple model like a cube can be represented with 12 triangles, 2 triangles for each of the 6 square faces. A curved or wavy surface on the other hand will be approximated with hundreds or thousands of small triangles. Many graphics and 3D printing applications like consuming models in triangle format as triangles are the simplest shape that's not a line or point.

    Binary STLs store triangles as 5 fields: 3 fields for each of the triangle's vertices, 1 field for the triangle's normal vector, and 1 for the attribute bytes. The normal vector isn't necessary for 3D printing but is useful for rendering and displaying your model: Most shaders use the normal for calculating [the effects of light on the model](https://www.scratchapixel.com/lessons/3d-basic-rendering/introduction-to-shading/diffuse-lambertian-shading.html) to produce realistic-looking renders. The binary STL file consists of these 5 fields in repetition to encode every triangle, plus a short header and tally of the number of triangles at the beginning.

VisCAM and SolidView, the two applications which are [documented](https://en.wikipedia.org/wiki/STL_(file_format)#Binary) to use the attribute byte count for color information, only consider the attribute valid if bit 15 is set to `1`. URLs [consist only of ASCII Characters](https://www.ietf.org/rfc/rfc3986.txt) and ASCII characters use only 7 bits, so in terms of bits information is laid out like `0####### 0#######`. The 15th bit will always be `0`, which means the encoded URL will not interfere with such applications. Yay computer science!
