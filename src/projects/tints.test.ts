import { expect, it } from 'vitest'
import { tintsFor } from './tints'

it('gives each professor one colour, in any order', () => {
  const tints = tintsFor(['b', 'a', 'b'])
  expect(tints).toEqual(tintsFor(['a', 'b']))
  expect(tints.get('a')).not.toBe(tints.get('b'))
})

it('uses the six colours again beyond six professors', () => {
  const tints = tintsFor(['a', 'b', 'c', 'd', 'e', 'f', 'g'])
  expect(tints.get('g')).toBe(tints.get('a'))
})
