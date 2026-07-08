/* Pochettes générées en SVG (port du prototype web).
   Si l'artiste a fourni une image, elle est affichée à la place. */

import { Image } from "expo-image";
import React from "react";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { hashCode, Track } from "./catalog";

const W = 400;
const H = 460;

const hsl = (h: number, s: number, l: number) =>
  `hsl(${((h % 360) + 360) % 360}, ${s}%, ${l}%)`;

export function CoverArt({ track }: { track: Track }) {
  if (track.coverUri) {
    return (
      <Image
        source={{ uri: track.coverUri }}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
      />
    );
  }

  const { hue: h1, hue2: h2 } = track;
  const seed = hashCode(track.id);
  const uid = track.id.replace(/[^a-z0-9]/gi, "");

  const stars = Array.from({ length: 26 }, (_, i) => (
    <Circle
      key={`s${i}`}
      cx={(seed * (i + 3) * 97) % W}
      cy={((seed >> 3) * (i + 7) * 61) % (H * 0.45)}
      r={0.6 + ((i * seed) % 10) / 9}
      fill="white"
      opacity={0.25 + (i % 5) / 8}
    />
  ));

  const mountains = (
    <>
      <Path
        d={`M0 ${H} L0 ${H - 150} L70 ${H - 210} L130 ${H - 160} L200 ${H - 235} L280 ${H - 150} L340 ${H - 195} L${W} ${H - 140} L${W} ${H} Z`}
        fill={hsl(h2, 45, 12)}
        opacity={0.95}
      />
      <Path
        d={`M0 ${H} L0 ${H - 95} L90 ${H - 150} L170 ${H - 100} L260 ${H - 165} L330 ${H - 105} L${W} ${H - 130} L${W} ${H} Z`}
        fill={hsl(h2, 40, 7)}
      />
    </>
  );

  let scene: React.ReactNode = null;

  switch (track.scene) {
    case "sun":
    case "moon": {
      const big = track.scene === "sun";
      scene = (
        <>
          {stars}
          <Circle cx={W / 2} cy={H * 0.42} r={big ? 130 : 85} fill={`url(#orb-${uid})`} />
          <Ellipse cx={W / 2} cy={H * 0.52} rx={150} ry={34} fill={hsl(h1, 80, 60)} opacity={0.18} />
          {mountains}
        </>
      );
      break;
    }
    case "waves":
      scene = (
        <>
          {stars}
          <Circle cx={W / 2} cy={H * 0.34} r={70} fill={`url(#orb-${uid})`} opacity={0.9} />
          {[0, 1, 2, 3, 4].map(i => (
            <Path
              key={`w${i}`}
              d={`M0 ${H * 0.5 + i * 55} Q ${W * 0.25} ${H * 0.5 + i * 55 - 32}, ${W * 0.5} ${H * 0.5 + i * 55} T ${W} ${H * 0.5 + i * 55} L ${W} ${H} L 0 ${H} Z`}
              fill={hsl(h2, 55 - i * 6, 16 - i * 2.5)}
              opacity={0.9 - i * 0.08}
            />
          ))}
        </>
      );
      break;
    case "rings":
      scene = (
        <>
          {stars}
          {[150, 118, 86, 54].map((r, i) => (
            <Circle
              key={`r${i}`}
              cx={W / 2}
              cy={H * 0.46}
              r={r}
              fill="none"
              stroke={hsl(h1 + i * 25, 85, 62 - i * 6)}
              strokeWidth={10 + ((seed >> (i % 20)) % 8)}
              opacity={0.75 - i * 0.1}
            />
          ))}
          <Circle cx={W / 2} cy={H * 0.46} r={30} fill={`url(#orb-${uid})`} />
        </>
      );
      break;
    case "grid":
      scene = (
        <>
          {stars}
          <Circle cx={W / 2} cy={H * 0.38} r={105} fill={`url(#orb-${uid})`} />
          {[0, 1, 2, 3, 4, 5, 6].map(i => (
            <Line
              key={`gh${i}`}
              x1={0}
              y1={H * 0.62 + i * i * 7}
              x2={W}
              y2={H * 0.62 + i * i * 7}
              stroke={hsl(h1, 90, 62)}
              strokeWidth={1.6}
              opacity={0.7 - i * 0.08}
            />
          ))}
          {[-3, -2, -1, 0, 1, 2, 3].map(i => (
            <Line
              key={`gv${i}`}
              x1={W / 2 + i * 34}
              y1={H * 0.62}
              x2={W / 2 + i * 130}
              y2={H}
              stroke={hsl(h1, 90, 62)}
              strokeWidth={1.6}
              opacity={0.5}
            />
          ))}
        </>
      );
      break;
    case "aurora":
      scene = (
        <>
          {stars}
          {[0, 1, 2].map(i => (
            <Path
              key={`a${i}`}
              d={`M${-40 + i * 60} ${H * 0.55} C ${W * 0.3} ${H * 0.1 + i * 40}, ${W * 0.6} ${H * 0.55 - i * 60}, ${W + 40} ${H * 0.15 + i * 50}`}
              fill="none"
              stroke={hsl(h1 + i * 30, 85, 60)}
              strokeWidth={46 - i * 10}
              strokeLinecap="round"
              opacity={0.3 - i * 0.06}
            />
          ))}
          {mountains}
        </>
      );
      break;
    case "bloom":
      scene = (
        <>
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => {
            const a = (i / 8) * Math.PI * 2;
            const cx = W / 2 + Math.cos(a) * 70;
            const cy = H * 0.44 + Math.sin(a) * 70;
            return (
              <Ellipse
                key={`b${i}`}
                cx={cx}
                cy={cy}
                rx={72}
                ry={40}
                fill={hsl(h1 + i * 12, 75, 45 + (i % 3) * 8)}
                opacity={0.45}
                transform={`rotate(${((a * 180) / Math.PI).toFixed(0)} ${cx} ${cy})`}
              />
            );
          })}
          <Circle cx={W / 2} cy={H * 0.44} r={34} fill={`url(#orb-${uid})`} />
        </>
      );
      break;
    default: // portrait abstrait
      scene = (
        <>
          <Rect x={0} y={0} width={W / 2} height={H} fill={hsl(h1, 70, 30)} opacity={0.55} />
          <Circle cx={W * 0.55} cy={H * 0.4} r={95} fill={hsl(h2, 30, 8)} />
          <Circle cx={W * 0.55} cy={H * 0.4} r={95} fill={`url(#orb-${uid})`} opacity={0.35} />
          <Path d={`M${W * 0.3} ${H} Q ${W * 0.55} ${H * 0.55} ${W * 0.8} ${H} Z`} fill={hsl(h2, 25, 6)} />
        </>
      );
  }

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <Defs>
        <LinearGradient id={`sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={hsl(h2, 45, 14)} />
          <Stop offset="0.55" stopColor={hsl((h1 + h2) / 2, 55, 26)} />
          <Stop offset="1" stopColor={hsl(h1, 65, 38)} />
        </LinearGradient>
        <RadialGradient id={`orb-${uid}`} cx="50%" cy="40%" r="65%">
          <Stop offset="0" stopColor={hsl(h1, 95, 72)} />
          <Stop offset="0.7" stopColor={hsl(h1, 85, 55)} />
          <Stop offset="1" stopColor={hsl(h1 + 20, 80, 45)} />
        </RadialGradient>
      </Defs>
      <Rect width={W} height={H} fill={`url(#sky-${uid})`} />
      {scene}
      <Rect width={W} height={H} fill="black" opacity={0.08} />
    </Svg>
  );
}
