import type { CSSProperties, ReactNode } from "react";

import type { Participant } from "colab-protocol";

import { usePresence } from "../../react/usePresence.js";

export interface AvatarStackRenderContext {
  index: number;
  size: number;
}

export interface AvatarStackProps {
  max?: number;
  size?: number;
  className?: string;
  style?: CSSProperties;
  avatarClassName?: string;
  overflowClassName?: string;
  renderAvatar?: (
    participant: Participant,
    context: AvatarStackRenderContext,
  ) => ReactNode;
}

const DEFAULT_SIZE = 32;
const OVERLAP_RATIO = 0.3;

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function visibleCount(rosterSize: number, max: number | undefined): number {
  if (max === undefined) return rosterSize;
  return Math.min(rosterSize, Math.max(0, Math.floor(max)));
}

function itemStyle(index: number, overlap: number): CSSProperties {
  return {
    display: "inline-flex",
    marginLeft: index === 0 ? 0 : -overlap,
  };
}

function circleStyle(size: number): CSSProperties {
  return {
    alignItems: "center",
    borderRadius: "50%",
    boxSizing: "border-box",
    display: "inline-flex",
    flex: "0 0 auto",
    fontSize: Math.max(10, Math.round(size * 0.38)),
    fontWeight: 600,
    height: size,
    justifyContent: "center",
    lineHeight: 1,
    overflow: "hidden",
    width: size,
  };
}

function defaultAvatar(
  participant: Participant,
  size: number,
  className: string | undefined,
): ReactNode {
  return (
    <span
      aria-label={participant.name}
      className={["colab-avatar-stack__avatar", className]
        .filter(Boolean)
        .join(" ")}
      style={{
        ...circleStyle(size),
        backgroundColor: participant.color,
        color: "#ffffff",
      }}
      title={participant.name}
    >
      {initials(participant.name)}
    </span>
  );
}

export function AvatarStack({
  max,
  size = DEFAULT_SIZE,
  className,
  style,
  avatarClassName,
  overflowClassName,
  renderAvatar,
}: AvatarStackProps): ReactNode {
  const participants = usePresence();
  const count = visibleCount(participants.length, max);
  const visible = participants.slice(0, count);
  const overflow = participants.length - count;
  const overlap = Math.round(size * OVERLAP_RATIO);

  return (
    <div
      aria-label="Participants"
      className={["colab-avatar-stack", className].filter(Boolean).join(" ")}
      role="list"
      style={{ alignItems: "center", display: "inline-flex", ...style }}
    >
      {visible.map((participant, index) => (
        <span
          className="colab-avatar-stack__item"
          key={participant.id}
          role="listitem"
          style={itemStyle(index, overlap)}
        >
          {renderAvatar?.(participant, { index, size }) ??
            defaultAvatar(participant, size, avatarClassName)}
        </span>
      ))}
      {overflow > 0 ? (
        <span
          aria-label={`${String(overflow)} more participants`}
          className={["colab-avatar-stack__overflow", overflowClassName]
            .filter(Boolean)
            .join(" ")}
          role="listitem"
          style={{
            ...circleStyle(size),
            backgroundColor: "#f3f4f6",
            color: "#111827",
            marginLeft: count === 0 ? 0 : -overlap,
          }}
          title={`${String(overflow)} more participants`}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
