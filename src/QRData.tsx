import crc16ccitt from 'crc/calculators/crc16ccitt'
import { sortBy } from 'lodash'

export type QRDataComponentValue = null | string | QRData

export class QRData {
  components: Record<string, QRDataComponentValue>

  constructor(components: Record<string, QRDataComponentValue>) {
    this.components = components
  }

  toString(): string {
    return sortBy(Object.entries(this.components), ([k]: [string, any]) => k)
      .map(([key, comp]: [key: string, comp: QRDataComponentValue]) => {
        if (!key.match(/^[0-9]{2}$/)) {
          throw new Error("Key should be a 2-digit numeric key code")
        }

        if (comp === null) {
          return ''
        }

        const encodedValue = (typeof comp === 'string') ? comp : comp.toString()

        const length = encodedValue.length

        if (length > 99) {
          throw new Error("Encoded length should not exceed 99!")
        }

        return [
          key,
          length.toString().padStart(2, '0'),
          encodedValue,
        ].join('')
      })
      .join('')
  }

  toStringWithCRC(): string {
    const result = this.toString() + '6304'
    const rcode = crc16ccitt(new TextEncoder().encode(result)).toString(16).padStart(4, '0').toUpperCase();

    return result + rcode
  }
}
