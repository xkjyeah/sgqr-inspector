import { useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'

type ImageData = ReturnType<CanvasRenderingContext2D["getImageData"]>

export function ImageCapturer<R>(props: {
  children: (props: {
    captureImage: () => void,
    stopCapture: () => void,
    isCapturing: boolean,
  }) => React.ReactNode,
  tester: ((arg0: ImageData) => R),
  onImageCaptured: ((arg0: R) => void)
}) {
  const video = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isCapturing, setIsCapturing] = useState(false);
  const { onImageCaptured, tester } = props

  const stopCapture = useCallback(() => {
    if (video.current) {
      video.current.srcObject = null
      video.current.pause()
      video.current = null
    }
    setIsCapturing(false)
  }, [])

  const tick = useCallback(() => {
    const ve = video.current

    if (!ve) return
    if (!canvasRef.current) return

    if (ve.readyState === ve.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current.getContext('2d')

      if (!canvas) return
      canvasRef.current.height = ve.videoHeight;
      canvasRef.current.width = ve.videoWidth;
      canvas.drawImage(ve, 0, 0, canvasRef.current.width, canvasRef.current.height);
      const imageData = canvas.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);

      const test = tester(imageData)
      if (test) {
        onImageCaptured(test)
        stopCapture()
        return
      }
    }
    requestAnimationFrame(tick);
  }, [onImageCaptured, tester, stopCapture])

  const captureImage = useCallback(() => {
    if (!video.current) {
      const newVideo = document.createElement("video")

      // Use facingMode: environment to attempt to get the front camera on phones
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "environment" } })
        .then(function (stream) {
          newVideo.srcObject = stream;
          newVideo.setAttribute("playsinline", 'true'); // required to tell iOS safari we don't want fullscreen
          newVideo.play();
          requestAnimationFrame(tick);
        });

      video.current = newVideo
    }
    setIsCapturing(true)
  }, [tick])

  return <>
    {props.children({ captureImage, isCapturing, stopCapture })}
    <PopupSpace style={{ display: isCapturing ? undefined : 'none', textAlign: 'center' }}>
      <button onClick={stopCapture}>Stop Capture</button>
      <canvas ref={canvasRef} width="500" height="500" style={{ height: 'auto', width: '100%', maxWidth: '500px', display: isCapturing ? 'block' : 'none' }}></canvas>
    </PopupSpace>
  </>
}

function PopupSpace(props: { children: Array<React.ReactNode>, style: Record<string, string | number | null | undefined> }) {
  return createPortal(
    <div className="canvas-portal" style={props.style}>
      {props.children}
    </div>,
    document.body
  )
}
