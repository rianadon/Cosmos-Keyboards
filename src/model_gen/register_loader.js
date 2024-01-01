import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./src/model_gen/loader.js', pathToFileURL('./'))
