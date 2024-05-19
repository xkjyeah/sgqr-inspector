import type { ParseResult, ParsedElement } from './EMVCoMPMContext'

export type PaymentMethod = {
  rawData: string,
  iconURL: string,
  description: string,
  protocol: string,
}

export const extractPaymentMethodsFromParseResult = (elements: ParsedElement[]): PaymentMethod[] => {
  return elements.map(pme => ({
    rawData: pme.rawValue,
    description: (pme.interpretation as ParseResult).context.name,
    protocol: (pme.interpretation as ParseResult).elements
      .find((e): e is ParsedElement => (e as ParsedElement).elementID === '00')?.rawValue || 'Unknown',
    iconURL: '',
  }))
}