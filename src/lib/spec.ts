import { z } from 'zod'
import * as LZString from 'lz-string'

const ZoneEnum = z.enum(['public', 'private', 'service'])
const EdgeTypeEnum = z.enum(['adjacent', 'near', 'separate', 'avoid'])

export const SpaceSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  area_target: z.number().min(0),
  zone: ZoneEnum,
  tags: z.array(z.string()).optional(),
  meta: z.record(z.string(), z.any()).optional(),
  relations: z
    .object({
      positive: z.array(z.string()).optional().default([]),
      negative: z.array(z.string()).optional().default([]),
    })
    .optional()
    .default({ positive: [], negative: [] }),
})

export const EdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  weight: z.number().min(0).optional().default(1),
  type: EdgeTypeEnum.optional().default('adjacent'),
  meta: z.record(z.string(), z.any()).optional(),
})

export const BubbleSpecSchema = z.object({
  meta: z
    .object({
      title: z.string().optional(),
      author: z.string().optional(),
      external: z
        .object({
          scenicView: z.boolean().optional(),
          noiseControl: z.boolean().optional(),
          ventilation: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  spaces: z.array(SpaceSchema),
  edges: z.array(EdgeSchema).optional().default([]),
})

export type BubbleSpec = z.infer<typeof BubbleSpecSchema>

export function validateSpec(obj: unknown) {
  return BubbleSpecSchema.safeParse(obj)
}

export function parseSpecFromString(text: string) {
  try {
    const parsed = JSON.parse(text)
    return validateSpec(parsed)
  } catch (e) {
    return { success: false, error: e }
  }
}

export function encodeSpecToQuery(spec: BubbleSpec) {
  const json = JSON.stringify(spec)
  return LZString.compressToEncodedURIComponent(json)
}

export function decodeSpecFromQuery(encoded: string) {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded)
    if (!json) return { success: false, error: 'decompress failed' }
    const parsed = JSON.parse(json)
    return validateSpec(parsed)
  } catch (e) {
    return { success: false, error: e }
  }
}

export function formatZodErrors(error: unknown): string {
  if (error instanceof z.ZodError) {
    const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    return issues || 'Validation error'
  }
  return String(error)
}

export function clampNodeRadius(areaTarget: number, minRadius: number = 8, maxRadius: number = 40): number {
  const base = Math.sqrt(areaTarget || 1) * 2.5
  return Math.max(minRadius, Math.min(maxRadius, base + 6))
}

// Room configuration by type
interface RoomConfig {
  roomType: '1' | '2' | '3' | '4'
  rooms: Array<{
    id: string
    name: string
    zone: 'public' | 'private' | 'service'
  }>
}

const ROOM_CONFIGS: Record<'1' | '2' | '3' | '4', RoomConfig['rooms']> = {
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

// Preset relations per roomType: map room id -> relations
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

export interface FormData {
  roomType: '1' | '2' | '3' | '4'
  areas: {
    masterBedroom: number
    secondBedroom: number
    secondBedroom2: number
    secondBedroom3: number
    livingRoom: number
    diningRoom: number
    kitchen: number
    bathroom: number
    balcony: number
    entryway: number
  }
  conditions: {
    scenicView: boolean
    noiseControl: boolean
    ventilation: boolean
  }
}

// exported RoomType (numeric) and helper to produce default FormData for a room type
export type RoomType = 1 | 2 | 3 | 4

export function getDefaultSpecByRoomType(roomType: RoomType): FormData {
  const rt = String(roomType) as FormData['roomType']
  // Provide distinct defaults per room type so generated spaces differ visibly
  let defaultAreas: FormData['areas']
  switch (roomType) {
    case 1:
      defaultAreas = {
        masterBedroom: 14,
        secondBedroom: 0,
        secondBedroom2: 0,
        secondBedroom3: 0,
        livingRoom: 30,
        diningRoom: 6,
        kitchen: 9,
        bathroom: 5,
        balcony: 6,
        entryway: 3,
      }
      break
    case 2:
      defaultAreas = {
        masterBedroom: 13,
        secondBedroom: 11,
        secondBedroom2: 0,
        secondBedroom3: 0,
        livingRoom: 28,
        diningRoom: 8,
        kitchen: 8,
        bathroom: 4,
        balcony: 6,
        entryway: 3,
      }
      break
    case 3:
      defaultAreas = {
        masterBedroom: 12,
        secondBedroom: 10,
        secondBedroom2: 9,
        secondBedroom3: 0,
        livingRoom: 26,
        diningRoom: 8,
        kitchen: 8,
        bathroom: 4,
        balcony: 5,
        entryway: 3,
      }
      break
    case 4:
      defaultAreas = {
        masterBedroom: 12,
        secondBedroom: 10,
        secondBedroom2: 9,
        secondBedroom3: 8,
        livingRoom: 24,
        diningRoom: 8,
        kitchen: 8,
        bathroom: 4,
        balcony: 5,
        entryway: 3,
      }
      break
    default:
      defaultAreas = {
        masterBedroom: 12,
        secondBedroom: 10,
        secondBedroom2: 10,
        secondBedroom3: 10,
        livingRoom: 25,
        diningRoom: 8,
        kitchen: 8,
        bathroom: 4,
        balcony: 6,
        entryway: 3,
      }
  }
  const defaultConditions: FormData['conditions'] = { scenicView: false, noiseControl: false, ventilation: true }
  return { roomType: rt, areas: defaultAreas, conditions: defaultConditions }
}

export function generateSpacesByRoomType(roomType: '1' | '2' | '3' | '4', areas: FormData['areas'], conditions?: FormData['conditions']): BubbleSpec['spaces'] {
  const rooms = ROOM_CONFIGS[roomType]
  const areaMap: Record<string, number> = {
    bed1: areas.masterBedroom,
    bed2: areas.secondBedroom,
    bed3: areas.secondBedroom2,
    bed4: areas.secondBedroom3,
    living: areas.livingRoom,
    dining: areas.diningRoom,
    kitchen: areas.kitchen,
    bath: areas.bathroom,
    balcony: areas.balcony,
    entryway: areas.entryway,
  }
  
  const cond = conditions || { scenicView: false, noiseControl: false, ventilation: false }
  
  return rooms.map(room => {
    const tags: string[] = []
    
    // Add tags based on conditions
    if (cond.scenicView && (room.id === 'living' || room.id === 'bed1' || room.id === 'balcony')) {
      tags.push('view')
    }
    if (cond.noiseControl && (room.id === 'bed2' || room.id === 'bath')) {
      tags.push('noise')
    }
    if (cond.ventilation && (room.id === 'living' || room.id === 'kitchen' || room.id === 'entryway')) {
      tags.push('vent')
    }
    
    return {
      id: room.id,
      name: room.name,
      area_target: areaMap[room.id] || 5,
      zone: room.zone,
      ...(tags.length > 0 && { tags }),
      relations: { positive: [], negative: [] },
    }
  })
}

export function generateEdgesWithConditions(conditions?: FormData['conditions']): BubbleSpec['edges'] {
  const cond = conditions || { scenicView: false, noiseControl: false, ventilation: false }
  
  // Base edges for 2-room standard
  let edges: BubbleSpec['edges'] = [
    { source: 'entryway', target: 'living', weight: 2, type: 'adjacent' },
    { source: 'living', target: 'dining', weight: 2, type: 'adjacent' },
    { source: 'living', target: 'kitchen', weight: 1.5, type: 'adjacent' },
    { source: 'dining', target: 'kitchen', weight: 1.5, type: 'adjacent' },
    { source: 'living', target: 'bed1', weight: 1, type: 'near' },
    { source: 'living', target: 'bed2', weight: 1, type: 'near' },
    { source: 'living', target: 'balcony', weight: 1, type: 'adjacent' },
    { source: 'bed1', target: 'bath', weight: 0.5, type: 'adjacent' },
    { source: 'bed2', target: 'bath', weight: 0.5, type: 'adjacent' },
    { source: 'kitchen', target: 'bath', weight: 0.2, type: 'separate' },
  ]
  
  // Boost ventilation-related edges
  if (cond.ventilation) {
    edges = edges.map(e => {
      if ((e.source === 'bed1' || e.source === 'bed2' || e.source === 'bed3' || e.source === 'bed4') && (e.target === 'living' || e.target === 'entryway')) {
        return { ...e, weight: (e.weight || 1) * 1.5 }
      }
      if ((e.target === 'bed1' || e.target === 'bed2' || e.target === 'bed3' || e.target === 'bed4') && (e.source === 'living' || e.source === 'entryway')) {
        return { ...e, weight: (e.weight || 1) * 1.5 }
      }
      return e
    })
  }
  
  return edges
}

export function formDataToSpec(formData: FormData): BubbleSpec {
  const spaces = generateSpacesByRoomType(formData.roomType, formData.areas, formData.conditions)
  const edges = generateEdgesWithConditions(formData.conditions)
  // apply preset relations if available for this roomType
  const relationsForType = PRESET_RELATIONS[formData.roomType] || {}
  const spacesWithRelations = spaces.map(s => ({ ...s, relations: s.relations || { positive: [], negative: [] }, ...(relationsForType[s.id] ? { relations: relationsForType[s.id] } : {}) }))

  return {
    meta: {
      title: `${['一', '二', '三', '四'][parseInt(formData.roomType) - 1]}房型`,
      author: 'Bubble Graph Tool',
      external: {
        scenicView: formData.conditions.scenicView,
        noiseControl: formData.conditions.noiseControl,
        ventilation: formData.conditions.ventilation,
      },
    },
    spaces: spacesWithRelations,
    edges,
  }
}

// generateSpecByRoomType: returns FormData preset for a room type (wrapper for getDefaultSpecByRoomType)
export function generateSpecByRoomType(roomType: RoomType): FormData {
  return getDefaultSpecByRoomType(roomType)
}

export function specToFormData(spec: BubbleSpec): FormData {
  const spaces = spec.spaces || []
  const areaMap = Object.fromEntries(spaces.map(s => [s.id, s.area_target]))
  
  // Detect room type based on space count
  const roomType: '1' | '2' | '3' | '4' = (['1', '2', '3', '4'].find(rt => {
    const roomIds = ROOM_CONFIGS[rt as '1' | '2' | '3' | '4'].map(r => r.id)
    return roomIds.every(id => spaces.find(s => s.id === id))
  }) || '2') as '1' | '2' | '3' | '4'

  return {
    roomType,
    areas: {
      masterBedroom: areaMap['bed1'] || 12,
      secondBedroom: areaMap['bed2'] || 10,
      secondBedroom2: areaMap['bed3'] || 10,
      secondBedroom3: areaMap['bed4'] || 10,
      livingRoom: areaMap['living'] || 25,
      diningRoom: areaMap['dining'] || 8,
      kitchen: areaMap['kitchen'] || 8,
      bathroom: areaMap['bath'] || 4,
      balcony: areaMap['balcony'] || 6,
      entryway: areaMap['entryway'] || 3,
    },
    conditions: {
      scenicView: spec.meta?.external?.scenicView || false,
      noiseControl: spec.meta?.external?.noiseControl || false,
      ventilation: spec.meta?.external?.ventilation || false,
    },
  }
}

export const sampleSpec: BubbleSpec = {
  meta: { title: 'Sample Apartment', author: 'Bubble Graph Tool' },
  spaces: [
    { id: 'living', name: 'Living Room', area_target: 25, zone: 'public', relations: { positive: ['bed1'], negative: ['kitchen'] } },
    { id: 'kitchen', name: 'Kitchen', area_target: 8, zone: 'service', relations: { positive: [], negative: ['bed2'] } },
    { id: 'bed1', name: 'Bedroom 1', area_target: 12, zone: 'private', relations: { positive: ['bed2'], negative: [] } },
    { id: 'bed2', name: 'Bedroom 2', area_target: 10, zone: 'private', relations: { positive: [], negative: [] } },
    { id: 'bath', name: 'Bathroom', area_target: 4, zone: 'service', relations: { positive: [], negative: [] } },
  ],
  edges: [
    { source: 'living', target: 'kitchen', weight: 2, type: 'adjacent' },
    { source: 'living', target: 'bed1', weight: 1, type: 'near' },
    { source: 'living', target: 'bed2', weight: 1, type: 'near' },
    { source: 'bed1', target: 'bath', weight: 0.5, type: 'adjacent' },
    { source: 'bed2', target: 'bath', weight: 0.5, type: 'adjacent' },
    { source: 'kitchen', target: 'bath', weight: 0.2, type: 'separate' },
  ],
}

export const twoRoomStandardPreset: BubbleSpec = {
  meta: {
    title: '二房型標準',
    author: 'Bubble Graph Tool',
    external: {
      scenicView: false,
      noiseControl: false,
      ventilation: true,
    },
  },
  spaces: [
    { id: 'living', name: 'Living Room', area_target: 25, zone: 'public', tags: ['vent', 'view'], relations: { positive: [], negative: [] } },
    { id: 'dining', name: 'Dining Room', area_target: 8, zone: 'public', relations: { positive: [], negative: [] } },
    { id: 'kitchen', name: 'Kitchen', area_target: 8, zone: 'service', tags: ['vent'], relations: { positive: [], negative: [] } },
    { id: 'bath', name: 'Bathroom', area_target: 4, zone: 'service', tags: ['noise'], relations: { positive: [], negative: [] } },
    { id: 'bed1', name: 'Master Bedroom', area_target: 12, zone: 'private', tags: ['view'], relations: { positive: [], negative: [] } },
    { id: 'bed2', name: 'Secondary Bedroom', area_target: 10, zone: 'private', tags: ['noise'], relations: { positive: [], negative: [] } },
    { id: 'balcony', name: 'Balcony', area_target: 6, zone: 'public', tags: ['view'], relations: { positive: [], negative: [] } },
    { id: 'entryway', name: 'Entryway', area_target: 3, zone: 'public', tags: ['vent'], relations: { positive: [], negative: [] } },
  ],
  edges: [
    { source: 'entryway', target: 'living', weight: 2, type: 'adjacent' },
    { source: 'living', target: 'dining', weight: 2, type: 'adjacent' },
    { source: 'living', target: 'kitchen', weight: 1.5, type: 'adjacent' },
    { source: 'dining', target: 'kitchen', weight: 1.5, type: 'adjacent' },
    { source: 'living', target: 'bed1', weight: 1.5, type: 'near' },
    { source: 'living', target: 'bed2', weight: 1, type: 'near' },
    { source: 'living', target: 'balcony', weight: 1, type: 'adjacent' },
    { source: 'bed1', target: 'bath', weight: 0.5, type: 'adjacent' },
    { source: 'bed2', target: 'bath', weight: 0.5, type: 'adjacent' },
    { source: 'kitchen', target: 'bath', weight: 0.2, type: 'separate' },
  ],
}
