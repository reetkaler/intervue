import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#37322f",
          borderRadius: 7,
          color: "#f7f5f3",
          fontSize: 22,
          fontFamily: "Georgia, serif",
        }}
      >
        I
      </div>
    ),
    size
  );
}
