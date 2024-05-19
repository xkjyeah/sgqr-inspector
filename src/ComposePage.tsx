import './ComposePage.css'
import { AppStateContext, type ComposeState } from './State'
import { ImageCapturer } from './ImageCapturer'
import type { ParsedElement } from './EMVCoMPMContext'
import { EMVCoMPMContext, parseData, ParseError } from './EMVCoMPMContext'
import jsQR from 'jsqr'
import { PaymentMethod, extractPaymentMethodsFromParseResult } from './PaymentMethod'
import React, { useContext, useCallback, useRef, useEffect } from 'react'
import { uniqBy, sortBy } from 'lodash'
import type { QRCode } from 'jsqr'
import { DragSortableList } from './DragSortable'
import crc16ccitt from 'crc/calculators/crc16ccitt'
import * as qrcode from 'qrcode'

type ImageData = ReturnType<CanvasRenderingContext2D["getImageData"]>

function ComposePage(props: { pageData: ComposeState }) {
  const RImageCapturer = ImageCapturer<QRCode | null>
  const appStateContext = useContext(AppStateContext);
  const { pageData } = props

  const tester = useCallback((imageData: ImageData) => {
    return jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    })
  }, [])
  const handleImageCaptured = useCallback((result: ReturnType<typeof jsQR>) => {
    const parseResult = parseData(EMVCoMPMContext, result!.data)
    const paymentMethodElements = parseResult.elements.filter((e): e is ParsedElement =>
      !(e instanceof ParseError) &&
      e.elementID >= '26' && e.elementID <= '51'
    )
    const paymentMethods = extractPaymentMethodsFromParseResult(paymentMethodElements)
    appStateContext?.setPage({
      id: 'compose',
      data: {
        ...pageData,
        paymentMethods: uniqBy(uniqBy(pageData.paymentMethods.concat(
          paymentMethods
        ), r => r.rawData), r => r.protocol)
      }
    })
  }, [appStateContext, pageData])

  // Move item at position A to position B
  const handleSwap = useCallback((index: number, before: number) => {
    let paymentMethods: (typeof pageData)['paymentMethods'] = []

    if (index === before) { return }
    else if (index < before) {
      console.log(index, before)
      paymentMethods = pageData.paymentMethods.slice(0, index)
        .concat(pageData.paymentMethods.slice(index + 1, before))
        .concat([pageData.paymentMethods[index]])
        .concat(pageData.paymentMethods.slice(before))
    } else if (index > before) {
      paymentMethods = pageData.paymentMethods.slice(0, before)
        .concat([pageData.paymentMethods[index]])
        .concat(pageData.paymentMethods.slice(before, index))
        .concat(pageData.paymentMethods.slice(index + 1))
    }
    appStateContext?.setPage({
      id: 'compose',
      data: {
        ...pageData,
        paymentMethods
      }
    })
  }, [pageData])


  return <div className="compose-list">
    <button onClick={() => {
      appStateContext?.setPage({
        id: 'interpret',
        data: {}
      })
    }}>Back to interpretation</button>
    <DragSortableList onSwap={handleSwap}
      list={props.pageData.paymentMethods}>
      {({ item, index }) => (
        <div key={index}
          className="compose-list-item"
        >
          <b>{item.description}</b>
          <br />
          {item.protocol.toLowerCase()}
        </div>
      )
      }
    </DragSortableList >
    <RImageCapturer tester={tester} onImageCaptured={handleImageCaptured}>
      {({ captureImage, isCapturing }) => (<>
        {!isCapturing && <button
          onClick={captureImage}
        >Capture another QR code</button>
        }
      </>)}
    </RImageCapturer>
    <EMVCoQRImage paymentMethods={props.pageData.paymentMethods}></EMVCoQRImage>
  </div >
}


type QRDataComponentValue = null | string | QRData

class QRData {
  components: Record<string, QRDataComponentValue>

  constructor(components: Record<string, QRDataComponentValue>) {
    this.components = components
  }

  toString(): string {
    return sortBy(Object.entries(this.components), ([k, v]: [string, any]) => k)
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

const makePaymentMethodsMap = (i: PaymentMethod[]): Record<string, string> => {
  const realPaymentInformation = i.filter(pm => pm.protocol.toUpperCase() != 'SG.SGQR')
  const sgQrInformation = i.find(pm => pm.protocol.toUpperCase() === 'SG.SGQR')

  return Object.fromEntries(([
    ...realPaymentInformation.map((p, i): [string, string] => [(26 + i).toString(), p.rawData]),
    ['51', sgQrInformation?.rawData]
  ] as Array<[string, string | undefined]>).filter((b): b is [string, string] => !!b[1]))
}

function EMVCoQRImage(props: { paymentMethods: PaymentMethod[] }): React.ReactNode {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const data = new QRData({
    // EMV-Co specs: https://www.emvco.com/specifications/emv-qr-code-specification-for-payment-systems-emv-qrcps-merchant-presented-mode/
    '00': '01', // Payload format indicator: Version we're using
    '01': '11', // Point of initiation method: 11 - static, 12 - dynamic
    ...makePaymentMethodsMap(props.paymentMethods),
    '52': '0000', // Merchant category code
    '53': '702', // ISO 4217 code for SGD
    '58': 'SG',
    '59': 'NA', // Merchant name -- doesn't matter because PayNow has its own lookup
    '60': 'Singapore', // City
  })
  const [qrcodeDataURL, setQRCodeDataURL] = React.useState<string>('')
  const newData = data.toStringWithCRC()

  // The first time we render, the canvas ref isn't there yet :|
  // So we need to render using an effect
  useEffect(() => {
    if (canvasRef.current) {
      const canvasElem = canvasRef.current

      qrcode.toCanvas(canvasElem, newData, { errorCorrectionLevel: 'M', width: 1000, color: { dark: '#000000' } })
        .then(() => {
          setQRCodeDataURL(canvasElem.toDataURL())
        })
    }
  }, [newData])

  return (<>
    <canvas width="1000" height="1000" ref={canvasRef} style={{ display: 'none' }}></canvas>
    {qrcodeDataURL && <img src={qrcodeDataURL} className="generated-QR" style={{ maxWidth: '100%', height: 'auto' }} />}
  </>)
}

export default ComposePage
