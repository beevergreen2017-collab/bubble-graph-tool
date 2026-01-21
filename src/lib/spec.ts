import { z } from 'zod'
import * as LZString from 'lz-string'
import { getRoomTypePreset } from './presets'
import type { FormData, RoomType } from './types'

export type { FormData, RoomType } from './types'

const ZoneEnum = z.enum(['public', 'private', 'service', 'unit'])
const EdgeTypeEnum = z.enum(['adjacent', 'near', 'separate', 'avoid'])

export const SpaceSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  area_target: z.number().min(0),
  zone: ZoneEnum,
  areaMin: z.number().min(0).optional(),
  areaMax: z.number().min(0).optional(),
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

const SECONDARY_ROOM_PATTERN = /secondary/i

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
  const rooms = getRoomTypePreset(parseInt(roomType) as RoomType).rooms
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
      ...(room.areaMin !== undefined && { areaMin: room.areaMin }),
      ...(room.areaMax !== undefined && { areaMax: room.areaMax }),
      ...(tags.length > 0 && { tags }),
      relations: { positive: [], negative: [] },
    }
  })
}

function scaleRoomAreasToUnitTarget(spaces: BubbleSpec['spaces'], unitTargetAreaM2: number, allowanceRatio: number) {
  const rooms = spaces.map(space => ({ ...space }))
  const roomsSum = rooms.reduce((sum, space) => sum + (space.area_target || 0), 0)
  if (roomsSum <= 0 || unitTargetAreaM2 <= 0) {
    return { spaces: rooms, roomsSum, overBudget: false }
  }
  const scale = (unitTargetAreaM2 * (1 - allowanceRatio)) / roomsSum
  rooms.forEach(space => {
    let nextArea = (space.area_target || 0) * scale
    if (space.areaMin !== undefined) nextArea = Math.max(space.areaMin, nextArea)
    if (space.areaMax !== undefined) nextArea = Math.min(space.areaMax, nextArea)
    space.area_target = nextArea
  })
  let scaledSum = rooms.reduce((sum, space) => sum + (space.area_target || 0), 0)
  let overBudget = scaledSum > unitTargetAreaM2 * 0.95
  if (overBudget) {
    const rescale = (unitTargetAreaM2 * (1 - allowanceRatio)) / scaledSum
    rooms.forEach(space => {
      let nextArea = (space.area_target || 0) * rescale
      if (space.areaMin !== undefined) nextArea = Math.max(space.areaMin, nextArea)
      if (space.areaMax !== undefined) nextArea = Math.min(space.areaMax, nextArea)
      space.area_target = nextArea
    })
    scaledSum = rooms.reduce((sum, space) => sum + (space.area_target || 0), 0)
    overBudget = scaledSum > unitTargetAreaM2 * 0.95
    if (overBudget) {
      console.warn(`[bubble-graph] Rooms sum (${scaledSum.toFixed(1)} m²) exceeds 95% of unit target (${unitTargetAreaM2} m²) after scaling.`)
    }
  }
  return { spaces: rooms, roomsSum: scaledSum, overBudget }
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
  const preset = getRoomTypePreset(parseInt(formData.roomType) as RoomType)
  const allowanceRatio = preset.allowanceRatio ?? 0.15
  const spaces = generateSpacesByRoomType(formData.roomType, formData.areas, formData.conditions)
  const scaled = scaleRoomAreasToUnitTarget(spaces, preset.unitTargetAreaM2, allowanceRatio)
  const unitSpace: BubbleSpec['spaces'][number] = {
    id: 'unit',
    name: 'Unit',
    area_target: preset.unitTargetAreaM2,
    zone: 'unit',
    relations: { positive: [], negative: [] },
  }
  const roomsWithUnit: BubbleSpec['spaces'] = [unitSpace, ...scaled.spaces]
  const edges = generateEdgesWithConditions(formData.conditions)
  const allowedIds = new Set(preset.rooms.map(room => room.id))
  const relationsById = new Map(preset.relations.map(rel => [rel.source, rel]))
  const spacesWithRelations = roomsWithUnit.map(s => {
    if (s.id === 'unit') {
      return s
    }
    const presetRelations = relationsById.get(s.id)
    const relations = presetRelations
      ? {
        positive: presetRelations.positive.filter(id => allowedIds.has(id)),
        negative: presetRelations.negative.filter(id => allowedIds.has(id)),
      }
      : (s.relations || { positive: [], negative: [] })
    return { ...s, relations }
  })
  const filteredEdges = edges.filter(edge => allowedIds.has(edge.source) && allowedIds.has(edge.target))

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
    edges: filteredEdges,
  }
}

export function pruneSpecToRoomType(spec: BubbleSpec, roomType: RoomType): BubbleSpec {
  const preset = getRoomTypePreset(roomType)
  const allowedIds = new Set(preset.rooms.map(room => room.id))
  allowedIds.add('unit')
  const prunedSpaces = (spec.spaces || []).filter(space => allowedIds.has(space.id)).map(space => {
    const relations = space.relations || { positive: [], negative: [] }
    return {
      ...space,
      relations: {
        positive: (relations.positive || []).filter(id => allowedIds.has(id)),
        negative: (relations.negative || []).filter(id => allowedIds.has(id)),
      },
    }
  })
  const prunedEdges = (spec.edges || []).filter(edge => allowedIds.has(edge.source) && allowedIds.has(edge.target))

  if (import.meta.env.DEV && roomType === 1) {
    const secondaryFound = (spec.spaces || []).some(space => SECONDARY_ROOM_PATTERN.test(space.id) || SECONDARY_ROOM_PATTERN.test(space.name || ''))
    if (secondaryFound) {
      console.warn('[bubble-graph] Secondary bedroom detected in 1BR spec; pruning invalid rooms.')
    }
  }

  return {
    ...spec,
    spaces: prunedSpaces,
    edges: prunedEdges,
  }
}

export function buildPresetStateByRoomType(roomType: RoomType): { formData: FormData; spec: BubbleSpec } {
  const formData = getDefaultSpecByRoomType(roomType)
  const spec = formDataToSpec(formData)
  return { formData, spec }
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
    const roomIds = getRoomTypePreset(parseInt(rt, 10) as RoomType).rooms.map(r => r.id)
    return roomIds.every(id => spaces.find(s => s.id === id))
  }) || '2') as '1' | '2' | '3' | '4'
  const defaults = getDefaultSpecByRoomType(parseInt(roomType, 10) as RoomType)

  return {
    roomType,
    areas: {
      masterBedroom: areaMap['bed1'] ?? defaults.areas.masterBedroom,
      secondBedroom: areaMap['bed2'] ?? defaults.areas.secondBedroom,
      secondBedroom2: areaMap['bed3'] ?? defaults.areas.secondBedroom2,
      secondBedroom3: areaMap['bed4'] ?? defaults.areas.secondBedroom3,
      livingRoom: areaMap['living'] ?? defaults.areas.livingRoom,
      diningRoom: areaMap['dining'] ?? defaults.areas.diningRoom,
      kitchen: areaMap['kitchen'] ?? defaults.areas.kitchen,
      bathroom: areaMap['bath'] ?? defaults.areas.bathroom,
      balcony: areaMap['balcony'] ?? defaults.areas.balcony,
      entryway: areaMap['entryway'] ?? defaults.areas.entryway,
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
