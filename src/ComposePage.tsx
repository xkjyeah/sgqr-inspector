import './ComposePage.css'
import { AppStateContext, type ComposeState } from './State'
import { ImageCapturer } from './ImageCapturer'
import type { ParsedElement } from './EMVCoMPMContext'
import { EMVCoMPMContext, parseData, ParseError } from './EMVCoMPMContext'
import jsQR from 'jsqr'
import { PaymentMethod, extractPaymentMethodsFromParseResult } from './PaymentMethod'
import React, { useContext, useCallback, useRef, useEffect } from 'react'
import { uniqBy, reverse } from 'lodash'
import type { QRCode } from 'jsqr'
import { DragSortableList } from './DragSortable'
import * as qrcode from 'qrcode'
import { QRData } from './QRData'
import { PayNowQRDialog } from './PayNowQRDialog'

type ImageData = ReturnType<CanvasRenderingContext2D["getImageData"]>

const reverseUniqBy = function <R>(r: R[], arg: Parameters<typeof uniqBy<R>>[1]): R[] {
  return (reverse(uniqBy(reverse(r), arg)) as R[])
}

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
        paymentMethods: reverseUniqBy(uniqBy(pageData.paymentMethods.concat(
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

  const handleDelete = (i: number) => () => {
    appStateContext?.setPage({
      id: 'compose',
      data: {
        ...pageData,
        paymentMethods: props.pageData.paymentMethods.slice(0, i)
          .concat(props.pageData.paymentMethods.slice(i + 1))
      }
    })
  }

  const handleAddPayNow = (pm: PaymentMethod) => {
    appStateContext?.setPage({
      id: 'compose',
      data: {
        ...pageData,
        paymentMethods: reverseUniqBy(
          props.pageData.paymentMethods.concat([pm]),
          p => p.protocol
        )
      }
    })
  }

  return <div className="compose-list">
    <button onClick={() => {
      appStateContext?.setPage({
        id: 'interpret',
        data: { rawData: makeQRData(props.pageData.paymentMethods) }
      })
    }}>Back to interpretation</button>
    <DragSortableList onSwap={handleSwap}
      list={props.pageData.paymentMethods}>
      {({ item, index }) => (
        <div key={index}
          className="compose-list-item"
        >
          <div className="description">
            <b>{item.description}</b>
            <br />
            {item.protocol.toLowerCase()}
          </div>
          <button className="delete-button"
            onClick={handleDelete(index)}>
            🗑
          </button>
        </div>
      )
      }
    </DragSortableList >
    <PayNowQRDialog onConfirm={handleAddPayNow}>
      {({ openDialog }) => (<>
        {<button
          onClick={openDialog}
        >Add PayNow</button>
        }
      </>)}
    </PayNowQRDialog>
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

const makePaymentMethodsMap = (i: PaymentMethod[]): Record<string, string> => {
  const realPaymentInformation = i.filter(pm => pm.protocol.toUpperCase() != 'SG.SGQR')
  const sgQrInformation = i.find(pm => pm.protocol.toUpperCase() === 'SG.SGQR')

  return Object.fromEntries(([
    ...realPaymentInformation.map((p, i): [string, string] => [(26 + i).toString(), p.rawData]),
    ['51', sgQrInformation?.rawData]
  ] as Array<[string, string | undefined]>).filter((b): b is [string, string] => !!b[1]))
}

const makeQRData = (i: PaymentMethod[]): string => {
  const data = new QRData({
    // EMV-Co specs: https://www.emvco.com/specifications/emv-qr-code-specification-for-payment-systems-emv-qrcps-merchant-presented-mode/
    '00': '01', // Payload format indicator: Version we're using
    '01': '11', // Point of initiation method: 11 - static, 12 - dynamic
    ...makePaymentMethodsMap(i),
    '52': '0000', // Merchant category code
    '53': '702', // ISO 4217 code for SGD
    '58': 'SG',
    '59': 'NA', // Merchant name -- doesn't matter because PayNow has its own lookup
    '60': 'Singapore', // City
  })
  return data.toStringWithCRC()
}

function EMVCoQRImage(props: { paymentMethods: PaymentMethod[] }): React.ReactNode {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [qrcodeDataURL, setQRCodeDataURL] = React.useState<string>('')
  const newData = makeQRData(props.paymentMethods)

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
