;; This file includes functions from two different sources.
;;
;; The first half of the code comes from ibnuda's dactyl repository,
;; which derived from adereth's original dactyl keyboard.
;; https://github.com/ibnuda/dactyl-keyboard/
;;
;; The second half is from dereknheiley's compactyl keyboard.
;; Both of these codebases are used to generate models for use with Cosmos.
;; https://github.com/dereknheiley/compactyl/

(ns model-gen.keyholes)

(def ^:dynamic tk)
(def ^:dynamic cylinder)

(defn square [x y] (. tk square x y))
(defn cube [x y z] (. tk cube x y z))
(defn circle [r] (. tk circle r))
(defn union [& shapes] (. tk union (clj->js shapes)))
(defn difference [& shapes] (. tk difference (clj->js shapes)))
(defn hull [& shapes] (. tk hull (clj->js shapes)))
(defn extrude-linear [opts obj] (. tk extrudeLinear (clj->js opts) obj))
(defn extrude-rotate [opts obj] (. tk extrudeRotate (clj->js opts) obj))
(defn translate [[x y z] obj] (. tk translate x y z obj))
(defn mirror [[x y z] obj] (. tk mirror x y z obj))
(defn rotate [a [x y z] obj] (. tk rotate a x y z obj))
(defn scale [[x y z] obj] (. tk scale x y z obj))
(defn with-fn [fn obj] obj)
(defn deg2rad [x] (* x (/ Math/PI 180)))

(defn keyswitch-height
  "the y dimension of an mx style keyswitch, in millimeter."
  [c]
  (if (get c :configuration-ibnuda-edits?) 14.0 14.4))
(defn keyswitch-width
  "the x dimension of an mx style keyswitch, in millimeter."
  [c]
  (if (get c :configuration-ibnuda-edits?) 14.0 14.4))

(def alps-width
  "the x dimension of an alps style keyswitch, in millimeter."
  15.6)
(def alps-notch-width
  15.5)
(def alps-notch-height
  1)
(def alps-height
  "the y dimension of an alps style keyswitch, in millimeter."
  13)

(def sa-profile-key-height 12.7)
(def choc-profile-key-height 3.5)

(defn plate-thickness [c] (if (get c :configuration-ibnuda-edits?) 5 4))


(defn single-plate
  "Defines the form of switch hole. It determines the whether it uses
   box or mx style based on the `configuration-create-side-nub?`. It also
   asks whether it creates hotswap housing or not based on `configuration-use-hotswap?`.
   and determines whether it should use alps cutout or not based on  `configuration-use-alps?`"
  [c]
  (let [switch-type         (get c :configuration-switch-type)
        create-side-nub?    (case switch-type
                              :mx true
                              :mx-snap-in true
                              false) #_(get c :configuration-create-side-nub?)
      nub-height           (case switch-type
                              :mx-snap-in 0.75
                              0)
        use-alps?           (case switch-type
                              :alps true
                              false) #_(get c :configuration-use-alps?)
        use-choc?           (case switch-type
                              :choc true
                              false)
        use-hotswap?        (get c :configuration-use-hotswap?)
        alps-size           (if (get c :configuration-ibnuda-edits?) 2.7 2.2)
        alps-thickness      (if (get c :configuration-ibnuda-edits?) 2 1.5)
        holder-thickness    2
        mx-margin           4
        top-wall            (case switch-type
                              :alps (->> (cube (+ (keyswitch-width c) 3) alps-size (plate-thickness c))
                                         (translate [0
                                                     (+ (/ alps-size 2) (/ alps-height 2))
                                                     (/ (plate-thickness c) 2)]))
                              :choc (->> (cube (+ (keyswitch-width c) 3) holder-thickness (* (plate-thickness c) 0.65))
                                         (translate [0
                                                     (+ holder-thickness (/ (keyswitch-height c) 2))
                                                     (* (plate-thickness c) 0.7)]))
                              (->> (cube (+ (keyswitch-width c) mx-margin) holder-thickness (plate-thickness c))
                                   (translate [0
                                               (+ (/ holder-thickness 2) (/ (keyswitch-height c) 2))
                                               (/ (plate-thickness c) 2)])))
        left-wall           (case switch-type
                              :alps (union (->> (cube alps-thickness (+ (keyswitch-height c) 3) (plate-thickness c))
                                                (translate [(+ (/ alps-thickness 2) (/ 15.6 2))
                                                            0
                                                            (/ (plate-thickness c) 2)]))
                                           (->> (cube 1.5 (+ (keyswitch-height c) 3) 1.0)
                                                (translate [(+ (/ 1.5 2) (/ alps-notch-width 2))
                                                            0
                                                            (- (plate-thickness c)
                                                               (/ alps-notch-height 2))])))
                              :choc (->> (cube holder-thickness (+ (keyswitch-height c) 3.3) (* (plate-thickness c) 0.65))
                                         (translate [(+ (/ holder-thickness 2) (/ (keyswitch-width c) 2))
                                                     0
                                                     (* (plate-thickness c) 0.7)]))
                              (->> (cube holder-thickness (+ (keyswitch-height c) mx-margin) (plate-thickness c))
                                   (translate [(+ (/ holder-thickness 2) (/ (keyswitch-width c) 2))
                                               0
                                               (/ (plate-thickness c) 2)])))
        ;; side-nub            (->> (cylinder 1 2.75)
        ;;                          (rotate (/ Math/PI 2) [1 0 0])
        ;;                          (translate [(+ (/ (keyswitch-width c) 2)) 0 (+ 1 nub-height)])
        ;;                          (hull (->> (cube 1.5 2.75 (- (plate-thickness c) nub-height))
        ;;                                     (translate [(+ (/ 1.5 2) (/ (keyswitch-width c) 2))
        ;;                                                 0
        ;;                                                 (/ (+ (plate-thickness c) nub-height) 2)]))))
        side-nub            (.sideNub tk nub-height)
        ; the hole's wall.
        kailh-cutout (->> (cube (/ (keyswitch-width c) 3) 1.6 (+ (plate-thickness c) 1.8))
                          (translate [0
                                      (+ (/ 1.5 2) (+ (/ (keyswitch-height c) 2)))
                                      (/ (plate-thickness c))]))
        plate-half          (case switch-type
                              :kailh (union (difference top-wall kailh-cutout) left-wall)
                              (union top-wall
                                     left-wall
                                     (if create-side-nub? side-nub)))
        ; the bottom of the hole.
        swap-holder-z-offset (if use-choc? 1.5 -1.5)
        swap-holder         (->> (cube (+ (keyswitch-width c) 3) (/ (keyswitch-height c) 2) 3)
                                 (translate [0 (/ (+ (keyswitch-height c) 3) 4) swap-holder-z-offset]))
        ; for the main axis
        main-axis-hole      (->> (cylinder (/ 4.0 2) 10))
        plus-hole           (->> (cylinder (/ 3.3 2) 10)
                                 (translate (if use-choc? [-5 4 0] [-3.81 2.54 0])))
        minus-hole          (->> (cylinder (/ 3.3 2) 10)
                                 (translate (if use-choc? [0 6 5] [2.54 5.08 0])))
        plus-hole-mirrored  (->> (cylinder (/ 3.3 2) 10)
                                 (translate (if use-choc? [5 4 5] [3.81 2.54 0])))
        minus-hole-mirrored (->> (cylinder (/ 3.3 2) 10)
                                 (translate (if use-choc? [0 6 5] [-2.54 5.08 0])))
        friction-hole       (->> (cylinder (if use-choc? 1 (/ 1.7 2)) 10))
        friction-hole-right (translate [(if use-choc? 5.5 5) 0 0] friction-hole)
        friction-hole-left  (translate [(if use-choc? -5.5 -5) 0 0] friction-hole)
        hotswap-base-z-offset (if use-choc? 0.2 -2.6)
        hotswap-base-shape  (->> (cube 19 (if use-choc? 11.5 8.2) 3.5)
                                 (translate [0 5 hotswap-base-z-offset]))
        choc-socket-holder-height 5.5
        choc-socket-holder-thickness 1
        choc-hotswap-socket-holder (difference
                                (->> (cube 10 7 choc-socket-holder-height)
                                     (translate [2 5 hotswap-base-z-offset]))
                                (->> (cube 5 7 choc-socket-holder-height)
                                     (translate [-0.6 6 (+ hotswap-base-z-offset choc-socket-holder-thickness)]))
                                (->> (cube 7 7 choc-socket-holder-height)
                                     (translate [5 4 (+ hotswap-base-z-offset choc-socket-holder-thickness)]))
                                )
        hotswap-holder      (union (if use-choc? choc-hotswap-socket-holder ())
                                (difference swap-holder
                                        main-axis-hole
                                        (union plus-hole plus-hole-mirrored)
                                        (union minus-hole minus-hole-mirrored)
                                        friction-hole-left
                                        friction-hole-right
                                        hotswap-base-shape)
                                )]
    (difference (union plate-half
                       (->> plate-half
                            (mirror [1 0 0])
                            (mirror [0 1 0]))
                       (if (and use-hotswap?
                                (not use-alps?))
                         hotswap-holder
                         ())))))

;; Compactyl source begins here.


;;;;;;;;;;;;;;;;;
;; Switch Hole ;;
;;;;;;;;;;;;;;;;;

(def use_hotswap_holder true)   ; manufactured hotswap holder
(def use_solderless false)      ; solderless switch plate, RESIN PRINTER RECOMMENDED!
(def rmtz_solderless_inserts false) ; solderless switch plate, RESIN PRINTER RECOMMENDED!
(def wire-diameter 1.75)        ; outer diameter of silicone covered 22awg ~1.75mm 26awg ~1.47mm)

(def compactyl-keyswitch-height 13.8)
(def compactyl-keyswitch-width 13.9)
(def compactyl-plate-thickness 5)

(def retention-tab-thickness 1.5)
(def retention-tab-hole-thickness (- compactyl-plate-thickness retention-tab-thickness))
(def mount-width (+ compactyl-keyswitch-width 3))
(def mount-height (+ compactyl-keyswitch-height 3))

(def holder-x mount-width)
(def holder-thickness    (/ (- holder-x compactyl-keyswitch-width) 2))
(def holder-y            (+ compactyl-keyswitch-height (* holder-thickness 2)))
(def swap-z              3)
(def web-thickness (if use_hotswap_holder (+ compactyl-plate-thickness swap-z) compactyl-plate-thickness))
(def keyswitch-below-plate (- 8 web-thickness)) ; approx space needed below keyswitch, ameoba is 6mm
(def square-led-size     6)

(def hotswap-x2          (* (/ holder-x 3) 1.85))
(def hotswap-z           (+ swap-z 0.5));thickness of kailh hotswap holder + some margin of printing error (0.5mm)
(def hotswap-cutout-z-offset -2.6)
(def hotswap-cutout-2-x-offset (- (- (/ holder-x 4) 0.70)))
(def hotswap-cutout-3-y-offset 7.4)
(def hotswap-case-cutout-x-extra 2.75)


(def TRIANGLE-RES 3)
(def SQUARE-RES 4)
(def ROUND-RES 30)

(def hotswap-diode-cutout true)
(def north_facing true)
(def plate-holes false)         ; for SU120 square PCB with screw holes in corners

(defn make-hotswap-holder [hotswap-y1
                           hotswap-cutout-1-y-offset
                           hotswap-y2
                           hotswap-cutout-2-y-offset]
  ;irregularly shaped hot swap holder
  ;    ____________
  ;  |  _|_______|    |  hotswap offset from out edge of holder with room to solder
  ; y1 |_|_O__  \ _  y2  hotswap pin
  ;    |      \O_|_|  |  hotswap pin
  ;    |  o  O  o  |     fully supported friction holes
  ;    |    ___    |
  ;    |    |_|    |  space for LED under SMD or transparent switches
  ;
  ; can be described as having two sizes in the y dimension depending on the x coordinate
  (let [
        swap-x              holder-x
        swap-y              holder-y

        swap-offset-x       0
        swap-offset-y       (/ (- holder-y swap-y) 2)
        swap-offset-z       (- (/ swap-z 2)) ; the bottom of the hole.
        swap-holder         (->> (cube swap-x swap-y swap-z)
                                 (translate [swap-offset-x
                                             swap-offset-y
                                             swap-offset-z]))
        hotswap-x           holder-x ;cutout full width of holder instead of only 14.5mm
        hotswap-x3          (/ holder-x 4)
        hotswap-x4          (/ holder-x 5)
        hotswap-y3          (/ hotswap-y1 2)

        hotswap-cutout-1-x-offset (/ holder-x 3.99)
        hotswap-cutout-3-x-offset (- (/ holder-x 2) (/ hotswap-x3 2.01))
        hotswap-cutout-4-x-offset (- (/ hotswap-x3 2.02) (/ holder-x 1.98))

        hotswap-cutout-led-x-offset 0
        hotswap-cutout-led-y-offset -6

        hotswap-cutout-1    (->> (hull (->> (square (/ hotswap-x 2) (- hotswap-y1 0.4))
                                            (extrude-linear {:height 0.001 :twist 0 :convexity 0}))
                                       (->> (square (/ hotswap-x 2) (+ hotswap-y1 0.1))
                                            (extrude-linear {:height 0.001 :twist 0 :convexity 0})
                                            (translate [0 0 hotswap-z])
                                       )
                                 )
                                 (translate [hotswap-cutout-1-x-offset
                                             hotswap-cutout-1-y-offset
                                             (+ hotswap-cutout-z-offset (/ hotswap-z -2))])
                                 ; (color PIN)
                            )
        hotswap-cutout-2    (->> (hull (->> (square hotswap-x2 (- hotswap-y2 0.4))
                                            (extrude-linear {:height 0.001 :twist 0 :convexity 0}))
                                       (->> (square hotswap-x2 (+ hotswap-y2 0.1))
                                            (extrude-linear {:height 0.001 :twist 0 :convexity 0})
                                            (translate [0 0 hotswap-z])
                                       )
                                 )
                                 (translate [hotswap-cutout-2-x-offset
                                             hotswap-cutout-2-y-offset
                                             (+ hotswap-cutout-z-offset (/ hotswap-z -2))])
                                 ; (color RED)
                            )
        hotswap-cutout-3    (->> (cube hotswap-x3 hotswap-y3 hotswap-z)
                                 (translate [ hotswap-cutout-3-x-offset
                                              hotswap-cutout-3-y-offset
                                              hotswap-cutout-z-offset])
                                 ; (color ORA)
                                 )
        ;; ADDITION TO THE COMPACTYL: I've made this cube slightly wider on the left
        ;; to eliminate the little nub that appears
        hotswap-cutout-4    (->> (cube (+ 10 hotswap-x4) hotswap-y3 hotswap-z)
                                 (translate [ (- hotswap-cutout-4-x-offset 5)
                                              hotswap-cutout-3-y-offset
                                              hotswap-cutout-z-offset])
                                 ; (color BLU)
                            )
        hotswap-led-cutout  (->> (cube square-led-size square-led-size 10)
                                 (translate [ hotswap-cutout-led-x-offset
                                              hotswap-cutout-led-y-offset
                                              hotswap-cutout-z-offset]))

        diode-wire-dia 0.75
        diode-wire-channel-depth (* 1.5 diode-wire-dia)
        diode-body-width 2.2
        diode-body-length 4
        diode-corner-hole (->> (cylinder diode-wire-dia (* 2 hotswap-z))
                              (with-fn ROUND-RES)
                              (translate [-6.55 -6.75 0]))
        diode-view-hole   (->> (cube (/ diode-body-width 2) (/ diode-body-length 1.25) (* 2 hotswap-z))
                              (translate [-6.25 -3 0]))
        diode-socket-hole-left (->> (cylinder diode-wire-dia hotswap-z)
                                    (with-fn ROUND-RES)
                                    (translate [-6.85 1.5 0]))
        diode-channel-pin-left (->> (cube diode-wire-dia 2.5 diode-wire-channel-depth)
                                    (rotate (deg2rad 10) [0 0 1])
                                    (translate [-6.55  0 (* -0.49 diode-wire-channel-depth)])
                               )
        diode-socket-hole-right (->> (cylinder diode-wire-dia hotswap-z)
                                    (with-fn ROUND-RES)
                                    (translate [6.85 3.5 0]))
        diode-channel-pin-right (->> (cube diode-wire-dia 6.5 diode-wire-channel-depth)
                                    (rotate (deg2rad -5) [0 0 1])
                                    (translate [6.55  0 (* -0.49 diode-wire-channel-depth)])
                               )
        diode-channel-wire (translate [-6.25 -5.75 (* -0.49 diode-wire-channel-depth)]
                               (cube diode-wire-dia 2 diode-wire-channel-depth))
        diode-body (translate [-6.25 -3.0 (* -0.49 diode-body-width)]
                       (cube diode-body-width diode-body-length diode-body-width))
        diode-cutout (union diode-corner-hole
                            diode-view-hole
                            diode-channel-wire
                            diode-body)

        ; for the main axis
        main-axis-hole      (->> (cylinder (/ 4.1 2) 10)
                                 (with-fn ROUND-RES))
        pin-hole            (->> (cylinder (/ 3.3 2) 10)
                                 (with-fn ROUND-RES))
        plus-hole           (translate [-3.81 2.54 0] pin-hole)
        minus-hole          (translate [ 2.54 5.08 0] pin-hole)
        friction-hole       (->> (cylinder (/ 1.95 2) 10)
                                 (with-fn ROUND-RES))
        friction-hole-right (translate [ 5 0 0] friction-hole)
        friction-hole-left  (translate [-5 0 0] friction-hole)
        hotswap-shape
            (difference
                       ; (union
                               swap-holder
                               ; (debug diode-channel-wire))
                        main-axis-hole
                        plus-hole
                        minus-hole
                        friction-hole-left
                        friction-hole-right
                        (if hotswap-diode-cutout
                             (union diode-cutout
                                    diode-socket-hole-left
                                    diode-channel-pin-left
                                    ;; (mirror [1 0 0] diode-cutout)
                                    ;; diode-socket-hole-right
                                    ;; diode-channel-pin-right
                             )
                        )

                        hotswap-cutout-1
                        hotswap-cutout-2
                        hotswap-cutout-3
                        hotswap-cutout-4

                        hotswap-led-cutout)
       ]
       (if north_facing
           (->> hotswap-shape
                (mirror [1 0 0])
                (mirror [0 1 0])
           )
           hotswap-shape
       )
  )
)

;; Some extra code to export the functions for use in JS.

(defn jsify [f]
  (fn [toolkit c]
    (binding [tk toolkit
              cylinder (. toolkit -cylinder)]
      (f {:configuration-switch-type (case (. c -switchType)
                                       "mx" :mx
                                       "mxSnapIn" :mx-snap-in
                                       "alps" :alps
                                       "choc" :choc
                                       :box)
          :configuration-use-hotswap? (. c -useHotswap)
          :configuration-ibnuda-edits? true
          }))))

(defn switch-teeth-cutout []
  (let [
        ; cherry, gateron, kailh switches all have a pair of tiny "teeth" that stick out
        ; on the top and bottom, this gives those teeth somewhere to press into
        teeth-x        4.5
        teeth-y        0.75
        teeth-z-down   1.65
        teeth-z        (- compactyl-plate-thickness teeth-z-down)
        teeth-x-offset 0
        teeth-y-offset (+ (/ compactyl-keyswitch-height 2) (/ teeth-y 2.01))
        teeth-z-offset (- compactyl-plate-thickness (/ teeth-z 1.99) teeth-z-down)
       ]
      (->> (cube teeth-x teeth-y teeth-z)
           (translate [teeth-x-offset teeth-y-offset teeth-z-offset])
      )
  )
  )
; https://github.com/e3w2q/su120-keyboard
; https://github.com/joshreve/dactyl-keyboard/blob/dd706f14f9aacfc429160bf5b03b688fdb5ce2f4/src/generate_configuration.py#L434
(def plate_holes_width 14.3)
(def plate_holes_height 14.3)
(def plate_holes_diameter 1.6)
(def plate_holes_depth 20.0)
(defn switch-plate-holes-cutout []
  (let [ cutout-radius (/ plate_holes_diameter 2)
         cutout (->> (cylinder cutout-radius 99)
                     (with-fn 50))
         cutout-x (/ plate_holes_width  2)
         cutout-y (/ plate_holes_height 2)
       ]
    (union
      (translate [   cutout-x    cutout-y  0] cutout)
      (translate [(- cutout-x)   cutout-y  0] cutout)
      (translate [   cutout-x (- cutout-y) 0] cutout)
    )
  )
  )
(defn switch-corner-cutout []
  (let [ cutout-radius 0.75
         cutout (->> (cylinder cutout-radius 99)
                     (with-fn 15))
         cutout-x (- (/ compactyl-keyswitch-width  2) (/ cutout-radius 2))
         cutout-y (- (/ compactyl-keyswitch-height 2) (/ cutout-radius 2))
       ]
    (union
      (translate [   cutout-x    cutout-y  0] cutout)
      (translate [(- cutout-x)   cutout-y  0] cutout)
      (translate [   cutout-x (- cutout-y) 0] cutout)
    )
  )
  )

(defn rmtz_plate_holder []
  (let [
        rmtz-holder-x        holder-x
        rmtz-holder-y        holder-y ; should be less than or equal to holder-y
        rmtz-holder-z        5; //TODO increase to 6 and fix clip-in-cuts to static height
        rmtz-holder-offse-x 0
        rmtz-holder-offset-y (/ (- holder-y rmtz-holder-y) 2)
        rmtz-holder-offset-z (- (/ rmtz-holder-z 2)) ; the bottom of the hole.
        switch_socket_base  (cube rmtz-holder-x
                                  rmtz-holder-y
                                  rmtz-holder-z)

        switch_socket_base_cutout  (cube (- rmtz-holder-x 2.7)
                                         (- rmtz-holder-y 2.7)
                                         (+ rmtz-holder-z 0.1)
                                   )
        rmtz-holder-cutout-offset-y (- (/ rmtz-holder-y 2) 1.35)
        slide_in_cuts (->> (cylinder (/ 1.9 2) (+ rmtz-holder-z 0.1))
                           (with-fn ROUND-RES))

        rmtz-holder-clip-offset-x (- (/ rmtz-holder-x 2) 1.05)
        rmtz-holder-clip-offset-y (- (/ rmtz-holder-y 2) 2.7)
        rmtz-holder-clip-offset-z (- (- rmtz-holder-offset-z) 3)
        clip_in_cuts (->> (cylinder (/ 2 2) (- rmtz-holder-z 2))
                           (with-fn ROUND-RES))

        rmtz_plate_holder_shape
            (translate [rmtz-holder-offse-x
                        rmtz-holder-offset-y
                        rmtz-holder-offset-z]
                (difference (union switch_socket_base
                                   ; (debug slide_in_cuts) ; may have to disable below to appear
                            )
                            switch_socket_base_cutout
                            (translate [ 3.5 (- rmtz-holder-cutout-offset-y) 0 ] slide_in_cuts)
                            (translate [ 3.5    rmtz-holder-cutout-offset-y  0 ] slide_in_cuts)
                            (translate [-3.5    rmtz-holder-cutout-offset-y  0 ] slide_in_cuts)
                            (translate [-3.5 (- rmtz-holder-cutout-offset-y) 0 ] slide_in_cuts)

                            (translate [   rmtz-holder-clip-offset-x (- rmtz-holder-clip-offset-y)  rmtz-holder-clip-offset-z ] clip_in_cuts)
                            (translate [   rmtz-holder-clip-offset-x     rmtz-holder-clip-offset-y  rmtz-holder-clip-offset-z ] clip_in_cuts)
                            (translate [(- rmtz-holder-clip-offset-x)    rmtz-holder-clip-offset-y  rmtz-holder-clip-offset-z ] clip_in_cuts)
                            (translate [(- rmtz-holder-clip-offset-x) (- rmtz-holder-clip-offset-y) rmtz-holder-clip-offset-z ] clip_in_cuts)
            ))
       ]
       (if north_facing
           (->> rmtz_plate_holder_shape
                (mirror [1 0 0])
                (mirror [0 1 0])
           )
           rmtz_plate_holder_shape
       )
  )
  )

(defn solderless-plate []
  (let [
        solderless-x        holder-x
        solderless-y        holder-y ; should be less than or equal to holder-y
        solderless-z        4;
        solderless-cutout-z (* 1.01 solderless-z)
        solderless-offset-x 0
        solderless-offset-y (/ (- holder-y solderless-y) 2)
        solderless-offset-z (- (/ solderless-z 2)) ; the bottom of the hole.
        switch_socket_base  (cube solderless-x
                                  solderless-y
                                  solderless-z)
        wire-channel-diameter (+ 0.3 wire-diameter); elegoo saturn prints 1.75mm tubes ~1.62mm
        wire-channel-offset  (- (/ solderless-z 2) (/ wire-channel-diameter 3))
        led-cutout-x-offset  0
        led-cutout-y-offset -6
        led-cutout          (translate [0 -6 0]
                                 (cube square-led-size
                                       square-led-size
                                       solderless-cutout-z))
        main-axis-hole      (->> (cylinder (/ 4.1 2) solderless-cutout-z)
                                 (with-fn ROUND-RES))
        plus-hole           (->> (cylinder (/ 1.55 2) solderless-cutout-z)
                                 (with-fn ROUND-RES)
                                 (scale [1 0.85 1])
                                 (translate [-3.81 2.54 0]))
        minus-hole          (->> (cylinder (/ 1.55 2) solderless-cutout-z)
                                 (with-fn ROUND-RES)
                                 (scale [1 0.85 1])
                                 (translate [2.54 5.08 0]))
        friction-hole       (->> (cylinder (/ 1.95 2) solderless-cutout-z)
                                 (with-fn ROUND-RES))
        friction-hole-right (translate [ 5 0 0] friction-hole)
        friction-hole-left  (translate [-5 0 0] friction-hole)

        diode-wire-dia 0.75
        diode-row-hole   (->> (cylinder (/ diode-wire-dia 2) solderless-cutout-z)
                              (with-fn ROUND-RES)
                              (translate [3.65 3.0 0]))
        diode-pin  (translate [-3.15 3.0 (/ solderless-z 2)]
                       (cube 2 diode-wire-dia 2))
        diode-wire (translate [2.75 3.0 (/ solderless-z 2)]
                       (cube 2 diode-wire-dia 2))
        diode-body (translate [-0.2 3.0 (/ solderless-z 2)]
                       (cube 4 1.95 3))

        row-wire-radius             (/ wire-channel-diameter 2)
        row-wire-channel-end-radius 3.25
        row-wire-channel-end (->> (circle row-wire-radius)
                                  (with-fn 50)
                                  (translate [row-wire-channel-end-radius 0 0])
                                  (extrude-rotate {:angle 90})
                                  (rotate (deg2rad 90) [1 0 0])
                                  (translate [(+ 7 (- row-wire-channel-end-radius))
                                              5.08
                                              (+ wire-channel-offset (- row-wire-channel-end-radius))])
                             )
        row-wire-channel-ends (translate [8 5.08 -1.15]
                                  (union (cube 3 wire-channel-diameter solderless-z)
                                         (translate [(/ 3 -2) 0 0]
                                             (->> (cylinder (/ wire-channel-diameter 2) solderless-z)
                                                  (with-fn 50)))))
        row-wire-channel-cube-end (union (->> (cube wire-channel-diameter
                                                    wire-channel-diameter
                                                    wire-channel-diameter)
                                              (translate [6 5.08 (+ 0 wire-channel-offset)])
                                         )
                                         (->> (cylinder (/ wire-channel-diameter 2)
                                                        wire-channel-diameter)
                                              (with-fn 50)
                                              (translate [5 5.08 (+ (/ wire-channel-diameter 2) wire-channel-offset)])
                                         )
                                  )
        row-wire-channel-curve-radius 45
        row-wire-channel (union
                             (->> (circle row-wire-radius)
                                  (with-fn 50)
                                  (translate [row-wire-channel-curve-radius 0 0])
                                  (extrude-rotate {:angle 90})
                                  (rotate (deg2rad 90) [1 0 0])
                                  (rotate (deg2rad -45) [0 1 0])
                                  (translate [0
                                              5.08
                                              (+ 0.25 wire-channel-offset (- row-wire-channel-curve-radius))])
                             )
                             row-wire-channel-end
                             row-wire-channel-ends
                             row-wire-channel-cube-end
                             (->> (union row-wire-channel-end
                                         row-wire-channel-ends
                                         row-wire-channel-cube-end
                                  )
                                  (mirror [1 0 0])
                             )
                         )
        col-wire-radius       (+ 0.025 (/ wire-channel-diameter 2))
        col-wire-ends-radius  (+ 0.1   (/ wire-channel-diameter 2))
        col-wire-ends-zoffset    0.0725 ; should be diff of two magic numbers above
        col-wire-channel-curve-radius 15
        col-wire-channel (->> (circle col-wire-radius)
                              (with-fn 50)
                              (translate [col-wire-channel-curve-radius 0 0])
                              (extrude-rotate {:angle 90})
                              (rotate (deg2rad 135) [0 0 1])
                              (translate [(+ 3.10 col-wire-channel-curve-radius)
                                          0
                                          (- 0.1 wire-channel-offset)])
                         )

        solderless-shape
            (translate [solderless-offset-x
                        solderless-offset-y
                        solderless-offset-z]
                (difference (union switch_socket_base
                                   ;(debug row-wire-channel-cube-end) ; may have to disable below to appear
                            )
                            main-axis-hole
                            plus-hole
                            minus-hole
                            friction-hole-left
                            friction-hole-right
                            diode-row-hole
                            row-wire-channel
                            col-wire-channel
                            diode-pin
                            diode-body
                            diode-wire
                            led-cutout
            ))
       ]
       (if north_facing
           (->> solderless-shape
                (mirror [1 0 0])
                (mirror [0 1 0])
           )
           solderless-shape
       )
  )
)

(defn make-single-plate [mirror-internals hotswap-type]
 ; (render ;tell scad to try and cache this repetitive code, kinda screws up previews
  (let [top-wall (->> (cube mount-height 1.5 compactyl-plate-thickness)
                      (translate [0
                                  (+ (/ 1.5 2) (/ compactyl-keyswitch-height 2))
                                  (/ compactyl-plate-thickness 2)]))
        left-wall (->> (cube 1.5 mount-width compactyl-plate-thickness)
                       (translate [(+ (/ 1.5 2) (/ compactyl-keyswitch-width 2))
                                   0
                                   (/ compactyl-plate-thickness 2)]))
        plate-half (difference (union top-wall left-wall)
                               (switch-teeth-cutout)
                               (if plate-holes (switch-plate-holes-cutout)
                                               (switch-corner-cutout))
                   )
        plate (union plate-half
                  (->> plate-half
                       (mirror [1 0 0])
                       (mirror [0 1 0]))
                  hotswap-type
                  (if use_solderless (solderless-plate))
                  (if rmtz_solderless_inserts (rmtz_plate_holder))
              )
       ]
    (->> (if mirror-internals
           (->> plate (mirror [1 0 0]))
           plate
         )
    )
  )
 ; )
  )


(defn hotswaperoo [toolkit
                   hotswap-y1
                   hotswap-cutout-1-y-offset
                   hotswap-y2
                   hotswap-cutout-2-y-offset]
  (binding [tk toolkit
            cylinder (. toolkit -cylinder)]
    (make-hotswap-holder hotswap-y1
                         hotswap-cutout-1-y-offset
                         hotswap-y2
                         hotswap-cutout-2-y-offset)))

(set! (. js/exports -singlePlate) (jsify single-plate))
(set! (. js/exports -makeHotswapHolder) hotswaperoo)
