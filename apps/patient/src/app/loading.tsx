export default function Loading() {
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50">
      {/* Logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.svg"
        alt="Hutano Telehealth"
        width={220}
        height={59}
        className="mb-10 w-52"
        style={{ imageRendering: "crisp-edges" }}
      />
      {/* Dots loader */}
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-bounce [animation-delay:-0.32s]" />
        <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-bounce [animation-delay:-0.16s]" />
        <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-bounce" />
      </div>
    </div>
  );
}
