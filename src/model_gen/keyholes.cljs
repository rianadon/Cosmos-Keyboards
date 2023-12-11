(ns model-gen.keyholes)

(def ^:dynamic tk)
(def ^:dynamic cube)
(def ^:dynamic cylinder)

(defn union [& shapes] (. tk union (clj->js shapes)))
(defn difference [& shapes] (. tk difference (clj->js shapes)))
(defn translate [[x y z] obj] (. tk translate x y z obj))
(defn mirror [[x y z] obj] (. tk mirror x y z obj))
(defn rotate [a [x y z] obj] (. tk rotate a x y z obj))

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


(defn jsify [f]
  (fn [toolkit c]
    (binding [tk toolkit
              cube (. toolkit -cube)
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

(set! (. js/exports -singlePlate) (jsify single-plate))
