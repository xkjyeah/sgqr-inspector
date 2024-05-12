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

type ImageData = ReturnType<CanvasRenderingContext2D["getImageData"]>

function ComposePage(props: { pageData: ComposeState }) {
  const RImageCapturer = ImageCapturer<QRCode | null>
  const appStateContext = useContext(AppStateContext);

  const tester = useCallback((imageData: ImageData) => {
    return jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    })
  }, [])
  const handleCapture = useCallback((captureImage: () => Promise<ReturnType<typeof jsQR>>) => {
    captureImage().then((result) => {
      console.log(result)
      const parseResult = parseData(EMVCoMPMContext, result!.data)
      const paymentMethodElements = parseResult.elements.filter((e): e is ParsedElement =>
        !(e instanceof ParseError) &&
        e.elementID >= '26' && e.elementID < '51'
      )
      const paymentMethods = extractPaymentMethodsFromParseResult(paymentMethodElements)

      appStateContext?.setPage({
        id: 'compose',
        data: {
          ...props.pageData,
          paymentMethods: uniqBy(props.pageData.paymentMethods.concat(
            paymentMethods
          ), r => r.rawData)
        }
      })
    })
  }, [appStateContext, props.pageData])

  return <div className="compose-list">
    {props.pageData.paymentMethods.map(pm => (
      <div className="compose-list-item"><h3>{pm.description}</h3></div>
    ))}
    <RImageCapturer tester={tester}>
      {({ captureImage, isCapturing }) => (<>
        {!isCapturing && <button
          onClick={() => handleCapture(captureImage)}
        >Capture another QR code</button>
        }
      </>)}

    </RImageCapturer>
  </div>
}

export default ComposePage
