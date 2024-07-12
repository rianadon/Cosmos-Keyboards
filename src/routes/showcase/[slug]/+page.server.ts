import { error } from '@sveltejs/kit'
import { keyboards } from '../showcase.js'

export const load = ({ params }) => {
  const keyboard = keyboards.find(k => k.key == params.slug)

  if (!keyboard) {
    error(404, {
      message: 'Not found',
    })
  }

  return { keyboard }
}
