import { expose, transferHandlers } from 'comlink'
import * as api from './api'
import { asyncGeneratorTransferHandler } from './comlink-async-generator'

transferHandlers.set('asyncGenerator', asyncGeneratorTransferHandler)

expose(api)
