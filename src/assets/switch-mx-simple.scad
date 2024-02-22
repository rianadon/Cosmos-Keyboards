$fn=60;
/**
Adapted from https://www.thingiverse.com/thing:421524/files
I've deleted additional faces from the STL version of this file in blender.
I'm keeping this around just as reference, in case any modifications need to be made.

a cherry mx switch.

most of the measurements done with a caliper. some taken from
http://geekhack.org/index.php?topic=47744.0

This is just to illustrate and to drop in a a gross reference. It is mostly artistic apart from the steam and mounting plate dimensions
*/

// move the whole thing 3mm to give the empty space in usual keycaps.
// that is, the extra space inside a keycap female connector.
// i do that since i create all my keycaps with 0,0,0 being the internal base of the keycap
translate([0,0,10.12])
{

	// 3. bottom
	color("green")
		// 3.1 main body volume
		hull(){
				translate([0,0,-4 -5.3]) //steam + top
					cube([13.98,13.98,0.1], center=true);
				translate([0,0,-4 -5.3 -2.2]) //steam + top + straigth part
					cube([13.98,13.98,0.1], center=true);
				translate([0,0,-4 -5.3 -5.5]) //steam + top + bottom (measured 5.5)
					cube([12.74,13.6,0.1], center=true);
		}

		// 4. bottom guides
		// again, i'm assuming everything is centered...
		color("darkGreen"){
			// 4.1 cylinder
			translate([0,0,-4 -5.3 -5.5 -2/2]) //steam + top + bottom (measured 5.5)
				cylinder(r=3.85/2, h=4, center=true, $fn=4);
			// 4.2 PCB pins
			translate([4.95,0,-4 -5.3 -5.5 -2/2]) //steam + top + bottom (measured 5.5)
				cylinder(r=1.6/2, h=4, center=true, $fn=4);
			translate([-4.95,0,-4 -5.3 -5.5 -2/2]) //steam + top + bottom (measured 5.5)
				cylinder(r=1.6/2, h=4, center=true, $fn=4);
		}

		// 5. pins
		color("orange"){
			translate([-3.77,2.7,-4 -5.3 -5.5 -3.1/2]) //steam + top + bottom (measured 5.5)
				cube([.86, 0.2,3.1], center=true);
			translate([2.7,5.2,-4 -5.3 -5.5 -3.1/2]) //steam + top + bottom (measured 5.5)
				cube([.86, 0.2,3.1], center=true);
		}

}


