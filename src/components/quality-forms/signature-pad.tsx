"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

export function SignaturePad({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(Boolean(value));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#0f172a";
    if (value) {
      const image = new Image();
      image.onload = () => context.drawImage(image, 0, 0, width, height);
      image.src = value;
    }
  }, [value]);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const context = event.currentTarget.getContext("2d");
    const current = point(event);
    context?.beginPath();
    context?.moveTo(current.x, current.y);
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const context = event.currentTarget.getContext("2d");
    const current = point(event);
    context?.lineTo(current.x, current.y);
    context?.stroke();
    setHasInk(true);
  }

  function stop(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    onChange(event.currentTarget.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange("");
  }

  return <div className="rounded-xl border border-slate-300 bg-white p-3"><div className="mb-2 flex items-center justify-between"><span className="text-sm font-black text-slate-800">{label}</span><button type="button" onClick={clear} disabled={!hasInk} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-extrabold text-slate-500 hover:bg-slate-100 disabled:opacity-40"><Eraser className="h-3.5 w-3.5" />ניקוי</button></div><canvas ref={canvasRef} onPointerDown={start} onPointerMove={draw} onPointerUp={stop} onPointerCancel={stop} className="h-28 w-full touch-none rounded-lg border border-dashed border-slate-300 bg-white [cursor:crosshair]" aria-label={label} /><p className="mt-2 text-xs font-semibold text-slate-500">חתימה בעכבר או במגע</p></div>;
}
