/*
 * MeshBackground — drei animierte Orbs, fixed hinter allem.
 * Spec: PLAN.md §7.4. Bei prefers-reduced-motion: statisch.
 */
import "./mesh.css";

export function MeshBackground() {
  return (
    <div aria-hidden className="mesh-background">
      <div className="mesh-orb mesh-orb--1" />
      <div className="mesh-orb mesh-orb--2" />
      <div className="mesh-orb mesh-orb--3" />
    </div>
  );
}
