import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #2563eb 0%, #1d4ed8 55%, #172554 100%)",
        }}
      >
        <div
          style={{
            width: 132,
            height: 132,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 38,
            background: "rgba(255, 255, 255, 0.12)",
            border: "3px solid rgba(255, 255, 255, 0.22)",
            boxShadow: "0 18px 35px rgba(15, 23, 42, 0.32)",
          }}
        >
          <span
            style={{
              display: "flex",
              fontSize: 88,
              lineHeight: 1,
              filter: "drop-shadow(0 8px 8px rgba(15, 23, 42, 0.35))",
            }}
          >
            🏆
          </span>
        </div>
      </div>
    ),
    size
  );
}
