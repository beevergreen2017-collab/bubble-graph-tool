import type { RoomType } from './types'

export interface RoomPreset {
  id: string
  name: string
  zone: 'public' | 'private' | 'service'
  optional?: boolean
}

export interface RelationPreset {
  source: string
  positive: string[]
  negative: string[]
}

export interface RoomTypePreset {
  rooms: RoomPreset[]
  relations: RelationPreset[]
}

const ROOM_CONFIGS: Record<'1' | '2' | '3' | '4', RoomPreset[]> = {
  '1': [
    { id: 'living', name: 'Living Room', zone: 'public' },
    { id: 'kitchen', name: 'Kitchen', zone: 'service' },
    { id: 'bath', name: 'Bathroom', zone: 'service' },
    { id: 'bed1', name: 'Bedroom', zone: 'private' },
    { id: 'balcony', name: 'Balcony', zone: 'public' },
    { id: 'entryway', name: 'Entryway', zone: 'public' },
  ],
  '2': [
    { id: 'living', name: 'Living Room', zone: 'public' },
    { id: 'dining', name: 'Dining Room', zone: 'public' },
    { id: 'kitchen', name: 'Kitchen', zone: 'service' },
    { id: 'bath', name: 'Bathroom', zone: 'service' },
    { id: 'bed1', name: 'Master Bedroom', zone: 'private' },
    { id: 'bed2', name: 'Secondary Bedroom', zone: 'private' },
    { id: 'balcony', name: 'Balcony', zone: 'public' },
    { id: 'entryway', name: 'Entryway', zone: 'public' },
  ],
  '3': [
    { id: 'living', name: 'Living Room', zone: 'public' },
    { id: 'dining', name: 'Dining Room', zone: 'public' },
    { id: 'kitchen', name: 'Kitchen', zone: 'service' },
    { id: 'bath', name: 'Bathroom', zone: 'service' },
    { id: 'bed1', name: 'Master Bedroom', zone: 'private' },
    { id: 'bed2', name: 'Secondary Bedroom 1', zone: 'private' },
    { id: 'bed3', name: 'Secondary Bedroom 2', zone: 'private' },
    { id: 'balcony', name: 'Balcony', zone: 'public' },
    { id: 'entryway', name: 'Entryway', zone: 'public' },
  ],
  '4': [
    { id: 'living', name: 'Living Room', zone: 'public' },
    { id: 'dining', name: 'Dining Room', zone: 'public' },
    { id: 'kitchen', name: 'Kitchen', zone: 'service' },
    { id: 'bath', name: 'Bathroom', zone: 'service' },
    { id: 'bed1', name: 'Master Bedroom', zone: 'private' },
    { id: 'bed2', name: 'Secondary Bedroom 1', zone: 'private' },
    { id: 'bed3', name: 'Secondary Bedroom 2', zone: 'private' },
    { id: 'bed4', name: 'Secondary Bedroom 3', zone: 'private' },
    { id: 'balcony', name: 'Balcony', zone: 'public' },
    { id: 'entryway', name: 'Entryway', zone: 'public' },
  ],
}

const PRESET_RELATIONS: Record<'1' | '2' | '3' | '4', Record<string, { positive: string[]; negative: string[] }>> = {
  '1': {
    living: { positive: ['balcony'], negative: ['kitchen'] },
    bed1: { positive: [], negative: ['kitchen'] },
  },
  '2': {
    living: { positive: ['dining', 'balcony'], negative: [] },
    bed1: { positive: ['bed2'], negative: [] },
    bed2: { positive: [], negative: ['kitchen'] },
  },
  '3': {
    living: { positive: ['dining'], negative: [] },
    bed1: { positive: ['bed2'], negative: [] },
    bed2: { positive: ['bed3'], negative: [] },
  },
  '4': {
    living: { positive: ['dining'], negative: [] },
    bed1: { positive: ['bed2'], negative: [] },
    bed3: { positive: [], negative: ['bed4'] },
  },
}

export function getRoomTypePreset(roomType: RoomType): RoomTypePreset {
  const rt = String(roomType) as keyof typeof ROOM_CONFIGS
  const rooms = ROOM_CONFIGS[rt]
  const relationsByRoom = PRESET_RELATIONS[rt] || {}
  const relations: RelationPreset[] = Object.entries(relationsByRoom).map(([source, relation]) => ({
    source,
    positive: relation.positive,
    negative: relation.negative,
  }))
  return { rooms, relations }
}
