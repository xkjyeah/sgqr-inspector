import { useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'

type ImageData = ReturnType<CanvasRenderingContext2D["getImageData"]>

export function ImageCapturer<R>(props: {
  children: (props: {
    captureImage: () => Promise<R>,
    stopCapture: () => void,
    isCapturing: boolean,
  }) => React.ReactNode,
  tester: ((arg0: ImageData) => R)
}) {
  const video = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isCapturing, setIsCapturing] = useState(false);

  const stopCapture = useCallback(() => {
    if (video.current) {
      video.current.srcObject = null
      video.current.pause()
      video.current = null
    }
    setIsCapturing(false)
  }, [])

  const [promiseResolvers, setPromiseResolvers] = useState<{
    resolve: (a: R) => void,
    reject: (e: Error) => void,
  }>({
    resolve: () => { },
    reject: () => { },
  });

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

      const test = props.tester(imageData)
      if (test) {
        promiseResolvers.resolve(test)
        stopCapture()
        return
      }
    }
    requestAnimationFrame(tick);
  }, [promiseResolvers, props, stopCapture])

  const captureImage = useCallback(() => {
    return new Promise<R>((resolve, reject) => {
      setPromiseResolvers({ resolve, reject })
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
    })
  }, [tick])

  const forceStopCapture = useCallback(() => {
    promiseResolvers.reject(new Error('Force stopped'));
    stopCapture()
  }, [stopCapture, promiseResolvers])

  return <>
    {props.children({ captureImage, isCapturing, stopCapture: forceStopCapture })}
    <PopupSpace style={{ display: isCapturing ? undefined : 'none', textAlign: 'center' }}>
      <button onClick={stopCapture}>Stop Capture</button>
      <canvas ref={canvasRef} width="500" height="500" style={{ height: 'auto', width: '100%', display: isCapturing ? 'block' : 'none' }}></canvas>
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
