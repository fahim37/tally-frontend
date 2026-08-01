"use client";

import { toTallyGroups } from "@/lib/money";

interface TallyMarksProps {
  count: number;
  /** Marks per group before the strike-through. */
  strikeAt?: number;
  /** Stroke height in px — 13 on a tap tile, 10 in a history heading. */
  height?: number;
  /** Animate the newest group in. Off for static lists. */
  animate?: boolean;
  className?: string;
}

/**
 * Tally marks, the way you'd keep score on paper: four strokes then a fifth
 * struck through them.
 *
 * The count is expressed as marks rather than a number because that is the
 * app's whole premise — you read seven cigarettes as a shape, not as "7".
 */
export function TallyMarks({
  count,
  strikeAt = 5,
  height = 13,
  animate = false,
  className,
}: TallyMarksProps) {
  if (count <= 0) return null;

  const groups = toTallyGroups(count, strikeAt);
  const width = height <= 10 ? 1.4 : 1.6;
  const gap = height <= 10 ? 2 : 2.5;

  return (
    <span
      className={className}
      style={{ display: "inline-flex", gap: 5, alignItems: "center" }}
      role="img"
      aria-label={`${count} logged`}
    >
      {groups.map((group, index) => (
        <span
          key={group.key}
          style={{
            position: "relative",
            display: "inline-flex",
            gap,
            // Only the group that just appeared animates, so adding a mark
            // doesn't restage the whole row.
            animation:
              animate && index === groups.length - 1
                ? "tallyIn .22s cubic-bezier(.3,1.4,.5,1) both"
                : undefined,
          }}
        >
          {group.bars.map((bar) => (
            <span
              key={bar}
              style={{
                display: "block",
                width,
                height,
                background: "currentColor",
                borderRadius: 1,
              }}
            />
          ))}
          {group.full && (
            <span
              style={{
                position: "absolute",
                left: -3,
                right: -3,
                top: "50%",
                height: width,
                background: "currentColor",
                borderRadius: 1,
                transform: "rotate(-22deg)",
              }}
            />
          )}
        </span>
      ))}
    </span>
  );
}

export default TallyMarks;
