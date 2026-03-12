import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size: sizeStr } = await params;
  const size = Math.min(Math.max(parseInt(sizeStr) || 192, 64), 1024);

  const diamond = Math.round(size * 0.42);
  const radius  = Math.round(diamond * 0.13);

  return new ImageResponse(
    (
      <div
        style={{
          width:  size,
          height: size,
          background: "linear-gradient(145deg, #FF6B33 0%, #FF5A1F 50%, #D94F0F 100%)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
        }}
      >
        {/* White diamond (rotated square) — the ◆ from the nav logo, scaled up */}
        <div
          style={{
            width:        diamond,
            height:       diamond,
            background:   "rgba(255, 255, 255, 0.92)",
            borderRadius: radius,
            transform:    "rotate(45deg)",
            boxShadow:    "0 4px 20px rgba(0, 0, 0, 0.22)",
          }}
        />
      </div>
    ),
    { width: size, height: size }
  );
}
