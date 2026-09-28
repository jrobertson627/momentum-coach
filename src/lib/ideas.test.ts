import { describe, expect, it } from 'vitest'
import { parkedNotes, splitNotes } from './ideas'

describe('parked idea notes', () => {
  it('round-trips a definition of done', () => {
    const notes = parkedNotes('Chapter 10 exercises pass')
    expect(splitNotes(notes!)).toEqual({
      definitionOfDone: 'Chapter 10 exercises pass',
      rest: '',
    })
  })

  it('has no notes when there is no definition of done', () => {
    expect(parkedNotes('')).toBeUndefined()
  })

  it('keeps other notes separate from the definition of done', () => {
    expect(splitNotes('Done when: It ships\nSaw a talk about this')).toEqual({
      definitionOfDone: 'It ships',
      rest: 'Saw a talk about this',
    })
  })

  it('treats plain notes as notes', () => {
    expect(splitNotes('Just a thought')).toEqual({
      definitionOfDone: '',
      rest: 'Just a thought',
    })
    expect(splitNotes(null)).toEqual({ definitionOfDone: '', rest: '' })
  })
})
