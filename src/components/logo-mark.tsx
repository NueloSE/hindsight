/** The Hindsight mark: a lowercase h over a highlighter stroke. Shared by icons and the preview card. */
export function LogoMark({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <rect width="64" height="64" rx="14" fill="#1F1C17" />
      <rect x="13" y="40" width="38" height="11" rx="2.5" fill="#F3D36B" opacity="0.9" />
      <path
        d="M23 13v33M23 32c0-6.5 4.2-10 9.2-10S41 25.5 41 32v14"
        fill="none"
        stroke="#F6F3EE"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
