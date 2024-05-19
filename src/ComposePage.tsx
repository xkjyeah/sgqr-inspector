import './ComposePage.css'
import { AppStateContext, type ComposeState } from './State'
import { ImageCapturer } from './ImageCapturer'
import type { ParsedElement } from './EMVCoMPMContext'
import { EMVCoMPMContext, parseData, ParseError } from './EMVCoMPMContext'
import jsQR from 'jsqr'
import { extractPaymentMethodsFromParseResult } from './PaymentMethod'
import { useContext, useCallback } from 'react'
import { uniqBy } from 'lodash'
import type { QRCode } from 'jsqr'
import { DragSortableList } from './DragSortable'

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
      e.elementID >= '26' && e.elementID < '51'
    )
    const paymentMethods = extractPaymentMethodsFromParseResult(paymentMethodElements)
    appStateContext?.setPage({
      id: 'compose',
      data: {
        ...pageData,
        paymentMethods: uniqBy(pageData.paymentMethods.concat(
          paymentMethods
        ), r => r.rawData)
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
  </div >
}

export default ComposePage
