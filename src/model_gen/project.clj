(defproject dactyl-node "0.1.0-SNAPSHOT"
  :description "Cosmos Clojurescript Dependencies"

  :dependencies [[org.clojure/clojure "1.10.0"]
                 [org.clojure/clojurescript "1.10.773"]]

  :plugins [[lein-cljsbuild "1.1.7"]]
  :source-paths ["."]
  :compile-path "../../target/classes"
  :target-path "../../target/%s"

  :cljsbuild {
    :builds {:keyholes   {:source-paths ["."]
                          :compiler {
                                     :main "keyholes"
                                     :target :node
                                     :output-to "../../target/gen-keyholes.cjs"
                                     :optimizations :simple}}}})
