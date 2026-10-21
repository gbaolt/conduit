import { cn } from '@conduit/ui/lib/utils';

function Brand({
  className,
  textClassName,
}: {
  className?: string;
  textClassName?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <BrandIcon />
      <span
        className={cn(
          'text-foreground text-2xl leading-none font-semibold tracking-tight',
          textClassName
        )}
      >
        Conduit
      </span>
    </span>
  );
}

function BrandIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('text-foreground relative size-8', className)}
      width="512"
      height="512"
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="512" height="512" rx="128" fill="#0069a8" />
      <rect
        width="512"
        height="512"
        rx="128"
        fill="none"
        stroke="black"
        strokeOpacity="0.1"
        strokeWidth="48"
        pathLength="100"
        className="dark:stroke-white"
      />
      <clipPath id="clip"></clipPath>
      <defs>
        <linearGradient
          id="_r_p_"
          gradientUnits="userSpaceOnUse"
          gradientTransform="rotate(45)"
          style={{ transformOrigin: 'center center' }}
        >
          <stop stopColor="#0E84E9"></stop>
          <stop offset="1" stopColor="#4A00E0"></stop>
        </linearGradient>
        <radialGradient
          id="_r_q_"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(256) rotate(90) scale(512)"
        >
          <stop stopColor="white"></stop>
          <stop offset="1" stopColor="white" stopOpacity="0"></stop>
        </radialGradient>
      </defs>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 16 16"
        width="352"
        height="352"
        x="80"
        y="80"
        alignmentBaseline="middle"
        style={{ color: 'rgb(255, 255, 255)', width: '352px', height: '352px' }}
      >
        <path
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M4.75 5.75v4.5M8 5.75v4.5m3.25-4.5v4.5m3 .5v.5a2 2 0 0 1-2 2h-.5m2.5-8v-.5a2 2 0 0 0-2-2h-.5m-10 8v.5a2 2 0 0 0 2 2h.5m-2.5-8v-.5a2 2 0 0 1 2-2h.5"
        ></path>
      </svg>
    </svg>
  );
}

export { Brand, BrandIcon };
