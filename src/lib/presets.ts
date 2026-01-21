import type { RoomType } from './types'

export interface RoomPreset {
  id: string
  name: string
  zone: 'public' | 'private' | 'service'
  optional?: boolean
  areaMin?: number
  areaMax?: number
}

export interface RelationPreset {
  source: string
  positive: string[]
  negative: string[]
}

export interface RoomTypePreset {
  rooms: RoomPreset[]
  relations: RelationPreset[]
  unitTargetAreaM2: number
  allowanceRatio?: number
  unitPaddingPx?: number
}

const ROOM_TYPE_PRESETS: Record<'1' | '2' | '3' | '4', RoomTypePreset> = {
  '1': {
    rooms: [
      { id: 'living', name: 'Living Room', zone: 'public' },
      { id: 'kitchen', name: 'Kitchen', zone: 'service' },
      { id: 'bath', name: 'Bathroom', zone: 'service' },
      { id: 'bed1', name: 'Bedroom', zone: 'private' },
      { id: 'balcony', name: 'Balcony', zone: 'public' },
      { id: 'entryway', name: 'Entryway', zone: 'public' },
    ],
    relations: [
      { source: 'living', positive: ['balcony'], negative: ['kitchen'] },
      { source: 'bed1', positive: [], negative: ['kitchen'] },
    ],
    unitTargetAreaM2: 35,
    allowanceRatio: 0.15,
    unitPaddingPx: 10,
  },
  '2': {
    rooms: [
      { id: 'living', name: 'Living Room', zone: 'public' },
      { id: 'dining', name: 'Dining Room', zone: 'public' },
      { id: 'kitchen', name: 'Kitchen', zone: 'service' },
      { id: 'bath', name: 'Bathroom', zone: 'service' },
      { id: 'bed1', name: 'Master Bedroom', zone: 'private' },
      { id: 'bed2', name: 'Secondary Bedroom', zone: 'private' },
      { id: 'balcony', name: 'Balcony', zone: 'public' },
      { id: 'entryway', name: 'Entryway', zone: 'public' },
    ],
    relations: [
      { source: 'living', positive: ['dining', 'balcony'], negative: [] },
      { source: 'bed1', positive: ['bed2'], negative: [] },
      { source: 'bed2', positive: [], negative: ['kitchen'] },
    ],
    unitTargetAreaM2: 60,
    allowanceRatio: 0.15,
    unitPaddingPx: 10,
  },
  '3': {
    rooms: [
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
    relations: [
      { source: 'living', positive: ['dining'], negative: [] },
      { source: 'bed1', positive: ['bed2'], negative: [] },
      { source: 'bed2', positive: ['bed3'], negative: [] },
    ],
    unitTargetAreaM2: 85,
    allowanceRatio: 0.15,
    unitPaddingPx: 10,
  },
  '4': {
    rooms: [
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
    relations: [
      { source: 'living', positive: ['dining'], negative: [] },
      { source: 'bed1', positive: ['bed2'], negative: [] },
      { source: 'bed3', positive: [], negative: ['bed4'] },
    ],
    unitTargetAreaM2: 150,
    allowanceRatio: 0.15,
    unitPaddingPx: 10,
  },
}

export function getRoomTypePreset(roomType: RoomType): RoomTypePreset {
  const rt = String(roomType) as keyof typeof ROOM_TYPE_PRESETS
  return ROOM_TYPE_PRESETS[rt]
}
