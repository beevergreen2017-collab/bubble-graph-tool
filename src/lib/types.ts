export type RoomType = 1 | 2 | 3 | 4

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
