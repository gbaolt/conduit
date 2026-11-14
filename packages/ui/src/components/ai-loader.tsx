'use client';

import {
  useDotMatrixPhases,
  usePrefersReducedMotion,
} from '@conduit/ui/hooks/dotmatrix-hooks';
import {
  type DotAnimationResolver,
  DotMatrix3Base,
  type DotMatrixCommonProps,
  spiralInward3NormFromIndex,
  spiralInward3OrderValue,
  wave3PathOpacityFromNorm,
} from '@conduit/ui/lib/dotmatrix-core';
import type { CSSProperties } from 'react';

export type AILoaderProps = DotMatrixCommonProps;

const animationResolver: DotAnimationResolver = ({
  isActive,
  index,
  reducedMotion,
  phase,
}) => {
  if (!isActive) {
    return { className: 'dmx-inactive' };
  }

  const order = spiralInward3OrderValue(index, '3x4');
  const pathNorm = spiralInward3NormFromIndex(index, '3x4');
  const style = { '--dmx-spiral-order': order } as CSSProperties;

  if (reducedMotion || phase === 'idle') {
    return {
      style: {
        ...style,
        opacity: wave3PathOpacityFromNorm(pathNorm),
      },
    };
  }

  return { className: 'dmx-spiral-snake-3', style };
};

/** A light that snakes inward along a spiral through 3 columns by 4 rows of dots. */
export function AILoader({
  speed = 0.5,
  pattern = 'full',
  dotShape = 'square',
  cellPadding = 2,
  animated = true,
  hoverAnimated = false,
  ...props
}: AILoaderProps) {
  const reducedMotion = usePrefersReducedMotion();
  const {
    phase: matrixPhase,
    onMouseEnter,
    onMouseLeave,
  } = useDotMatrixPhases({
    animated: Boolean(animated && !reducedMotion),
    hoverAnimated: Boolean(hoverAnimated && !reducedMotion),
    speed,
  });

  return (
    <DotMatrix3Base
      {...props}
      grid="3x4"
      size={props.size ?? 24}
      dotSize={props.dotSize ?? 4}
      cellPadding={cellPadding}
      speed={speed}
      pattern={pattern}
      dotShape={dotShape}
      animated={animated}
      phase={matrixPhase}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      reducedMotion={reducedMotion}
      animationResolver={animationResolver}
    />
  );
}
