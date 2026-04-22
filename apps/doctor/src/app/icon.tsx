import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: 512,
        height: 512,
        background: "white",
        display: "flex",
        position: "relative",
      }}
    >
      {/* Vertical cross arm */}
      <div style={{ position: "absolute", left: 192, top: 64, width: 128, height: 384, borderRadius: 40, background: "linear-gradient(135deg, #F07038, #D45520)", display: "flex" }} />
      {/* Horizontal cross arm */}
      <div style={{ position: "absolute", left: 64, top: 192, width: 384, height: 128, borderRadius: 40, background: "linear-gradient(135deg, #F07038, #D45520)", display: "flex" }} />
      {/* Teal centre */}
      <div style={{ position: "absolute", left: 192, top: 192, width: 128, height: 128, borderRadius: 20, background: "#1A6E7E", display: "flex" }} />
      {/* Connector lines */}
      <div style={{ position: "absolute", left: 249, top: 120, width: 14, height: 72, background: "#0D5060", display: "flex" }} />
      <div style={{ position: "absolute", left: 249, top: 320, width: 14, height: 72, background: "#0D5060", display: "flex" }} />
      <div style={{ position: "absolute", left: 120, top: 249, width: 72, height: 14, background: "#0D5060", display: "flex" }} />
      <div style={{ position: "absolute", left: 320, top: 249, width: 72, height: 14, background: "#0D5060", display: "flex" }} />
      {/* Circuit nodes at arm tips */}
      <div style={{ position: "absolute", left: 232, top: 72, width: 48, height: 48, borderRadius: 24, background: "#0D5060", display: "flex" }} />
      <div style={{ position: "absolute", left: 232, top: 392, width: 48, height: 48, borderRadius: 24, background: "#0D5060", display: "flex" }} />
      <div style={{ position: "absolute", left: 72, top: 232, width: 48, height: 48, borderRadius: 24, background: "#0D5060", display: "flex" }} />
      <div style={{ position: "absolute", left: 392, top: 232, width: 48, height: 48, borderRadius: 24, background: "#0D5060", display: "flex" }} />
      {/* Centre dot */}
      <div style={{ position: "absolute", left: 230, top: 230, width: 52, height: 52, borderRadius: 26, background: "#0D5060", display: "flex" }} />
    </div>,
    { ...size }
  );
}
